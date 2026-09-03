import pytest
from datetime import date

from app import models


def _minimal_entry_payload(token_id: str) -> dict:
    return {
        "token_id": token_id,
        "article_type_id": 1,
        "market_value": 1000000.0,
        "consideration_amount": 1000000.0,
    }


def test_gap1_slot_booking_flow(client, db_session, auth_headers):
    # Seed a real office so the booking validation (office must exist) passes.
    district = models.District(name="Pune")
    db_session.add(district)
    db_session.flush()
    office = models.RegistrationOffice(name="SR Pune", district_id=district.id)
    db_session.add(office)
    db_session.flush()
    office_id = office.id

    # 1. Get available slots
    res = client.get(f"/api/slots/available?office_id={office_id}&office_type=Regular&date=2026-09-10", headers=auth_headers)
    assert res.status_code == 200
    slots = res.json()
    assert len(slots) > 0

    # 2. Book a slot
    slot_to_book = slots[0]
    book_payload = {
        "office_id": office_id,
        "office_type": "Regular",
        "date": "2026-09-10",
        "slot_number": slot_to_book["slot_number"],
        "slot_start_time": slot_to_book["slot_start_time"],
        "slot_end_time": slot_to_book["slot_end_time"],
    }
    res_book = client.post("/api/slots/book", json=book_payload, headers=auth_headers)
    assert res_book.status_code == 201, res_book.text
    booking_data = res_book.json()
    assert booking_data["slot_number"] == slot_to_book["slot_number"]

    # 2b. Booking against a non-existent office is rejected.
    res_bad_office = client.post("/api/slots/book", json={**book_payload, "office_id": 999_999}, headers=auth_headers)
    assert res_bad_office.status_code == 404

    # 2c. Booking with a malformed time string is rejected.
    res_bad_time = client.post(
        "/api/slots/book",
        json={**book_payload, "slot_start_time": "25:99"},
        headers=auth_headers,
    )
    assert res_bad_time.status_code == 422

    # 3. Double-booking should fail with 409
    res_double = client.post("/api/slots/book", json=book_payload, headers=auth_headers)
    assert res_double.status_code == 409

    # 4. Creating token with slot_booking_id
    token_payload = {
        "language": "Marathi",
        "district_id": district.id,
        "office_id": office_id,
        "presenter_name": "Test Presenter",
        "slot_booking_id": booking_data["id"],
    }
    res_token = client.post("/api/tokens", json=token_payload, headers=auth_headers)
    assert res_token.status_code == 201, res_token.text
    assert res_token.json()["slot_booking_id"] == booking_data["id"]

    # 4b. Attaching a slot booking that isn't ours is rejected.
    stranger = models.User(
        username="stranger",
        first_name="Stranger",
        email="stranger@example.com",
        mobile_number="9876543210",
        pin_code="411001",
        hashed_password="x",
    )
    db_session.add(stranger)
    db_session.flush()
    foreign_booking = models.SlotBooking(
        office_id=office_id,
        office_type="Regular",
        booking_date=date(2026, 9, 11),
        slot_number=slot_to_book["slot_number"],
        slot_start_time=slot_to_book["slot_start_time"],
        slot_end_time=slot_to_book["slot_end_time"],
        user_id=stranger.id,
        status="BOOKED",
    )
    db_session.add(foreign_booking)
    db_session.flush()
    res_foreign = client.post(
        "/api/tokens",
        json={**token_payload, "slot_booking_id": foreign_booking.id},
        headers=auth_headers,
    )
    assert res_foreign.status_code == 400


def test_gap3_property_missing_fields(client, auth_headers):
    # Create token and entry
    res_tok = client.post("/api/tokens", json={"language": "Marathi"}, headers=auth_headers)
    token_id = res_tok.json()["id"]

    res_entry = client.post("/api/documents", json=_minimal_entry_payload(token_id), headers=auth_headers)
    assert res_entry.status_code == 201, res_entry.text
    entry_id = res_entry.json()["id"]

    # Add property with Gap 3 fields
    prop_payload = {
        "district": "Pune",
        "village_name": "Haveli Village",
        "urban_rural": "Urban",
        "other_desc": "सदनिका नं: 3, 4था मजला",
        "eother_desc": "Flat No: 3, Floor No: 4",
        "potkharaba_area": 12.5,
        "other_right_mr": "इतर हक्क म",
        "other_right_en": "Other Right Eng",
    }
    res_prop = client.post(f"/api/documents/{entry_id}/properties", json=prop_payload, headers=auth_headers)
    assert res_prop.status_code == 201
    prop_data = res_prop.json()
    assert prop_data["eother_desc"] == "Flat No: 3, Floor No: 4"
    assert float(prop_data["potkharaba_area"]) == 12.5
    assert prop_data["other_right_en"] == "Other Right Eng"


def test_gap2_party_missing_fields(client, auth_headers):
    res_tok = client.post("/api/tokens", json={"language": "Marathi"}, headers=auth_headers)
    token_id = res_tok.json()["id"]
    res_entry = client.post("/api/documents", json=_minimal_entry_payload(token_id), headers=auth_headers)
    assert res_entry.status_code == 201, res_entry.text
    entry_id = res_entry.json()["id"]

    party_payload = {
        "party_type": "Seller/Vendor",
        "surname_en": "Kulkarni",
        "first_name_en": "Amit",
        "pan_number": "ABCDE1234F",
        "alias_name_en": "Amit K",
        "survey_no": "124/A",
        "khata_no": "99",
        "party_area": 500.0,
        "seller_first_name": "Ramesh",
    }
    res_party = client.post(f"/api/documents/{entry_id}/parties", json=party_payload, headers=auth_headers)
    assert res_party.status_code == 201
    party_data = res_party.json()
    assert party_data["alias_name_en"] == "Amit K"
    assert party_data["survey_no"] == "124/A"
    assert party_data["address_combined"] is not None

    # Mobile verification endpoint
    party_id = party_data["id"]
    res_mobile = client.post(f"/api/documents/{entry_id}/parties/{party_id}/verify-mobile", headers=auth_headers)
    assert res_mobile.status_code == 200
    assert res_mobile.json()["verified"] is True
