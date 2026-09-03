from datetime import datetime, date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from ..database import get_db
from ..security import get_current_user
from .. import models
from ..validators import validate_office_type, validate_slot_time

router = APIRouter(prefix="/api/slots", tags=["Slot Booking"])


class SlotItem(BaseModel):
    slot_number: int
    slot_start_time: str
    slot_end_time: str
    is_booked: bool = False


class BookSlotRequest(BaseModel):
    office_id: int
    office_type: str = "Regular"
    date: str  # YYYY-MM-DD
    slot_number: int
    slot_start_time: str
    slot_end_time: str

    @field_validator("office_type")
    @classmethod
    def _office_type(cls, v: str) -> str:
        return validate_office_type(v)

    @field_validator("slot_start_time", "slot_end_time")
    @classmethod
    def _slot_time(cls, v: str) -> str:
        return validate_slot_time(v)

    @field_validator("slot_number")
    @classmethod
    def _slot_number(cls, v: int) -> int:
        if v < 1:
            raise ValueError("Slot number must be a positive integer")
        return v


class SlotBookingOut(BaseModel):
    id: str
    office_id: int
    office_type: str
    booking_date: date
    slot_number: int
    slot_start_time: str
    slot_end_time: str
    user_id: str
    status: str


@router.get("/office-types", response_model=List[str])
def get_office_types():
    return ["Regular Office", "Model Office"]


@router.get("/available", response_model=List[SlotItem])
def get_available_slots(
    office_id: int,
    office_type: str = "Regular",
    date: str = "",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not date:
        date_obj = datetime.utcnow().date()
    else:
        try:
            date_obj = datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    config = (
        db.query(models.OfficeSlotConfig)
        .filter(models.OfficeSlotConfig.office_id == office_id)
        .first()
    )

    start_str = config.day_start_time if config else "07:50"
    end_str = config.day_end_time if config else "15:00"
    step_mins = config.slot_length_minutes if config else 10

    # Generate fixed slots
    sh, sm = map(int, start_str.split(":"))
    eh, em = map(int, end_str.split(":"))
    current_dt = datetime(2000, 1, 1, sh, sm)
    end_dt = datetime(2000, 1, 1, eh, em)

    slots: List[dict] = []
    slot_num = 1
    while current_dt + timedelta(minutes=step_mins) <= end_dt:
        next_dt = current_dt + timedelta(minutes=step_mins)
        slots.append({
            "slot_number": slot_num,
            "slot_start_time": current_dt.strftime("%H:%M"),
            "slot_end_time": next_dt.strftime("%H:%M"),
        })
        current_dt = next_dt
        slot_num += 1

    # Fetch booked slots
    booked_rows = (
        db.query(models.SlotBooking)
        .filter(
            models.SlotBooking.office_id == office_id,
            models.SlotBooking.booking_date == date_obj,
            models.SlotBooking.status == "BOOKED",
        )
        .all()
    )
    booked_slot_numbers = {b.slot_number for b in booked_rows}

    # Omit already booked slots (per reference behavior)
    available_slots = [
        SlotItem(
            slot_number=s["slot_number"],
            slot_start_time=s["slot_start_time"],
            slot_end_time=s["slot_end_time"],
            is_booked=False,
        )
        for s in slots
        if s["slot_number"] not in booked_slot_numbers
    ]

    return available_slots


@router.post("/book", response_model=SlotBookingOut, status_code=status.HTTP_201_CREATED)
def book_slot(
    payload: BookSlotRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        booking_date = datetime.strptime(payload.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    # Office must exist before we can book a slot against it.
    office = db.query(models.RegistrationOffice).filter(models.RegistrationOffice.id == payload.office_id).first()
    if not office:
        raise HTTPException(status_code=404, detail="Office not found.")

    # Cannot book a slot in the past.
    if booking_date < datetime.utcnow().date():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot book a slot for a date in the past.",
        )

    # Slot number must be within the office's generated daily grid so a caller
    # can't mint out-of-range slot numbers (or ride on a different office's layout).
    config = db.query(models.OfficeSlotConfig).filter(models.OfficeSlotConfig.office_id == payload.office_id).first()
    start_str = config.day_start_time if config else "07:50"
    end_str = config.day_end_time if config else "15:00"
    step_mins = config.slot_length_minutes if config else 10
    try:
        sh, sm = map(int, start_str.split(":"))
        eh, em = map(int, end_str.split(":"))
    except (ValueError, AttributeError):
        raise HTTPException(status_code=500, detail="Office slot configuration is invalid.")
    cursor = datetime(2000, 1, 1, sh, sm)
    end_dt = datetime(2000, 1, 1, eh, em)
    grid_size = 0
    while cursor + timedelta(minutes=step_mins) <= end_dt:
        cursor = cursor + timedelta(minutes=step_mins)
        grid_size += 1
    if payload.slot_number > grid_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Slot number {payload.slot_number} does not exist for this office on the selected date.",
        )

    existing = (
        db.query(models.SlotBooking)
        .filter(
            models.SlotBooking.office_id == payload.office_id,
            models.SlotBooking.booking_date == booking_date,
            models.SlotBooking.slot_number == payload.slot_number,
            models.SlotBooking.status == "BOOKED",
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This slot has already been booked by another user.",
        )

    booking = models.SlotBooking(
        office_id=payload.office_id,
        office_type=payload.office_type,
        booking_date=booking_date,
        slot_number=payload.slot_number,
        slot_start_time=payload.slot_start_time,
        slot_end_time=payload.slot_end_time,
        user_id=current_user.id,
        status="BOOKED",
    )
    db.add(booking)
    try:
        db.commit()
        db.refresh(booking)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Slot double-booking detected.",
        )

    return booking


@router.delete("/book/{booking_id}")
def cancel_slot_booking(
    booking_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    booking = (
        db.query(models.SlotBooking)
        .filter(
            models.SlotBooking.id == booking_id,
            models.SlotBooking.user_id == current_user.id,
        )
        .first()
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    booking.status = "CANCELLED"
    db.commit()
    return {"status": "cancelled", "booking_id": booking_id}
