import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios.js";
import HeaderSarita from "../components/HeaderSarita.jsx";
import Footer from "../components/Footer.jsx";
import { validateSlotBookingForm } from "../utils/validation.js";
import "./SlotBooking.css";

export default function SlotBooking() {
  const { t } = useTranslation(["pages", "common", "validation"]);
  const navigate = useNavigate();

  const todayStr = new Date().toISOString().split("T")[0];

  const [officeType, setOfficeType] = useState("Regular Office");
  const [districts, setDistricts] = useState([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState("");
  const [offices, setOffices] = useState([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState("");
  const [bookingDate, setBookingDate] = useState(todayStr);

  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingSlot, setBookingSlot] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    async function fetchDistricts() {
      try {
        const { data } = await api.get("/api/reference/districts");
        setDistricts(data || []);
        if (data && data.length > 0) {
          setSelectedDistrictId(data[0].id);
        }
      } catch {
        setError("Could not load districts list.");
      }
    }
    fetchDistricts();
  }, []);

  useEffect(() => {
    async function fetchOffices() {
      if (!selectedDistrictId) return;
      try {
        const { data } = await api.get(`/api/reference/offices?district_id=${selectedDistrictId}`);
        setOffices(data || []);
        if (data && data.length > 0) {
          setSelectedOfficeId(data[0].id);
        } else {
          setSelectedOfficeId("");
        }
      } catch {
        setOffices([]);
      }
    }
    fetchOffices();
  }, [selectedDistrictId]);

  async function handleShowSlots() {
    setError("");
    setSuccessMsg("");
    const validationError = validateSlotBookingForm({
      officeId: selectedOfficeId,
      bookingDate,
    });
    if (validationError) {
      setError(t(validationError));
      return;
    }

    setLoadingSlots(true);
    try {
      const typeParam = officeType.includes("Model") ? "Model" : "Regular";
      const { data } = await api.get(
        `/api/slots/available?office_id=${selectedOfficeId}&office_type=${typeParam}&date=${bookingDate}`
      );
      setSlots(data || []);
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not fetch available slots.");
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  async function handleBookSlot(slot) {
    setError("");
    setSuccessMsg("");
    setBookingSlot(true);
    try {
      const typeParam = officeType.includes("Model") ? "Model" : "Regular";
      const { data } = await api.post("/api/slots/book", {
        office_id: Number(selectedOfficeId),
        office_type: typeParam,
        date: bookingDate,
        slot_number: slot.slot_number,
        slot_start_time: slot.slot_start_time,
        slot_end_time: slot.slot_end_time,
      });

      setSuccessMsg(`Slot #${slot.slot_number} (${slot.slot_start_time}-${slot.slot_end_time}) booked successfully!`);
      
      // Auto navigate to new document entry with slot info
      setTimeout(() => {
        navigate("/entries/new", {
          state: {
            slotBookingId: data.id,
            officeId: selectedOfficeId,
            districtId: selectedDistrictId,
            bookingDate: bookingDate,
          },
        });
      }, 1000);
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not book slot. Please try another slot.");
      await handleShowSlots(); // Refresh grid
    } finally {
      setBookingSlot(false);
    }
  }

  const formattedDisplayDate = bookingDate
    ? bookingDate.split("-").reverse().join("/")
    : "";

  return (
    <div className="page-shell">
      <HeaderSarita />
      <div className="slot-booking-container">
        <div className="slot-title-banner">Book Your Time Slot for Office</div>
        <div className="slot-info-banner">
          Sub Registrar Offices are now operational on Saturday and Sunday. You can book your convenient time slot below.
        </div>

        {error && <div className="banner banner-error" style={{ marginBottom: "15px" }}>{error}</div>}
        {successMsg && <div className="banner banner-success" style={{ marginBottom: "15px", backgroundColor: "#c6f6d5", color: "#22543d", padding: "10px", borderRadius: "4px" }}>{successMsg}</div>}

        {/* Office Type Selector */}
        <div className="slot-card-box">
          <div className="slot-section-header">Select Office Type</div>
          <div className="slot-radio-group">
            <label className="slot-radio-label">
              <input
                type="radio"
                name="officeType"
                value="Regular Office"
                checked={officeType === "Regular Office"}
                onChange={(e) => setOfficeType(e.target.value)}
              />
              Regular Office
            </label>
            <label className="slot-radio-label">
              <input
                type="radio"
                name="officeType"
                value="Model Office"
                checked={officeType === "Model Office"}
                onChange={(e) => setOfficeType(e.target.value)}
              />
              Model Office
            </label>
          </div>
        </div>

        {/* Booking Details Card */}
        <div className="slot-card-box">
          <div className="slot-section-header">Booking Details</div>
          <div className="slot-form-row">
            <div className="slot-input-group">
              <label>Select District</label>
              <select
                className="slot-select"
                value={selectedDistrictId}
                onChange={(e) => setSelectedDistrictId(e.target.value)}
              >
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="slot-input-group">
              <label>Select Office to Book</label>
              <select
                className="slot-select"
                value={selectedOfficeId}
                onChange={(e) => setSelectedOfficeId(e.target.value)}
              >
                {offices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="slot-input-group">
              <label>Date</label>
              <input
                type="date"
                className="slot-date-input"
                value={bookingDate}
                min={todayStr}
                onChange={(e) => setBookingDate(e.target.value)}
              />
              <div className="slot-helper-text">
                Token As On Date: <b>{formattedDisplayDate}</b>
              </div>
            </div>

            <button
              type="button"
              className="btn-show-slots"
              onClick={handleShowSlots}
              disabled={loadingSlots}
            >
              {loadingSlots ? "Loading Slots..." : "Show Available Slots"}
            </button>
          </div>
        </div>

        {/* Slots Grid */}
        {slots.length > 0 && (
          <div className="slot-card-box">
            <div className="slot-section-header">Available Appointment Slots</div>
            <div className="slot-hint-text">
              Click on your preferred time shown below to book your slot
            </div>

            <div className="slot-grid-container">
              {slots.map((s) => (
                <div
                  key={s.slot_number}
                  className="slot-card"
                  onClick={() => !bookingSlot && handleBookSlot(s)}
                >
                  <div className="slot-card-num">#{s.slot_number}</div>
                  <div className="slot-card-time">
                    {s.slot_start_time}-{s.slot_end_time}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <div className="slot-action-footer">
          <button
            type="button"
            className="btn-slot-nav btn-slot-back"
            onClick={() => navigate(-1)}
          >
            Previous / मागे
          </button>
          <button
            type="button"
            className="btn-slot-nav btn-slot-report"
            onClick={() => navigate("/tokens")}
          >
            View Data Entry Details / डेटा एंट्री पहा
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
