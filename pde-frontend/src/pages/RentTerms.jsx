import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axios.js";
import HeaderSarita from "../components/HeaderSarita.jsx";
import Footer from "../components/Footer.jsx";
import "./RentTerms.css";

const BLANK_SLABS = Array.from({ length: 5 }, () => ({ to_month: "", rent: "" }));

export default function RentTerms() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [licensePeriod, setLicensePeriod] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [percentIncrement, setPercentIncrement] = useState(false);
  const [propertyUse, setPropertyUse] = useState("Residential");
  const [refundableDeposit, setRefundableDeposit] = useState("");
  const [nonRefundableDeposit, setNonRefundableDeposit] = useState("0");
  const [slabs, setSlabs] = useState(BLANK_SLABS);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function updateSlab(index, field, value) {
    setSlabs((s) => s.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  async function handleSave() {
    setError("");
    setSaving(true);
    try {
      const rent_slabs = slabs
        .filter((s) => s.to_month && s.rent)
        .map((s, i) => ({ from_month: i + 1, to_month: Number(s.to_month), rent: s.rent }));

      await api.post("/api/stamp/rent-terms", {
        document_entry_id: id,
        license_period_months: licensePeriod ? Number(licensePeriod) : null,
        from_date: fromDate || null,
        to_date: toDate || null,
        percent_increment_yearly: percentIncrement,
        property_use: propertyUse,
        refundable_deposit: refundableDeposit || null,
        non_refundable_deposit: nonRefundableDeposit || 0,
        rent_slabs,
      });
      navigate(`/entries/${id}/properties`);
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not save rent terms.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-shell">
      <HeaderSarita />
      <div className="page-body rent-body">
        <h1 className="rent-title">Rent &amp; Other Terms</h1>

        {error && <div className="banner banner-error">{error}</div>}

        <div className="rent-row">
          <label>License Period in Months:</label>
          <input value={licensePeriod} onChange={(e) => setLicensePeriod(e.target.value)} type="number" min="0" />
        </div>
        <div className="rent-row">
          <label>From Date:</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="rent-row">
          <label>To Date :</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} disabled />
        </div>

        <table className="rent-table">
          <thead>
            <tr>
              <th>From Month</th>
              <th>To Month</th>
              <th>
                Rent(Rs)
                <span className="rent-increment">
                  <input type="checkbox" checked={percentIncrement} onChange={(e) => setPercentIncrement(e.target.checked)} />
                  % increment in rent (Yearly)
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {slabs.map((row, i) => (
              <tr key={i}>
                <td>{i === 0 ? 1 : "-"}</td>
                <td><input value={row.to_month} onChange={(e) => updateSlab(i, "to_month", e.target.value)} /></td>
                <td><input value={row.rent} onChange={(e) => updateSlab(i, "rent", e.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="rent-radio-row">
          <label>Property Use</label>
          <span>
            <input type="radio" checked={propertyUse === "Residential"} onChange={() => setPropertyUse("Residential")} />
            Residential
          </span>
          <span>
            <input type="radio" checked={propertyUse === "Non-Residential"} onChange={() => setPropertyUse("Non-Residential")} />
            Non-Residential
          </span>
        </div>

        <div className="rent-row">
          <label>Refundable Deposit</label>
          <input value={refundableDeposit} onChange={(e) => setRefundableDeposit(e.target.value)} type="number" min="0" />
        </div>
        <div className="rent-row">
          <label>Non Refundable Deposit</label>
          <input value={nonRefundableDeposit} onChange={(e) => setNonRefundableDeposit(e.target.value)} type="number" min="0" />
        </div>

        <div className="rent-actions">
          <button className="btn btn-green" onClick={handleSave} disabled={saving}>
            {saving ? "Saving\u2026" : "OK"}
          </button>
          <button className="btn btn-red" onClick={() => navigate("/tokens")}>CANCEL</button>
        </div>
      </div>
      <Footer office={{ dig: "Latur", jdr: "Latur", sro: "Joint S.R.Udgir 1" }} />
    </div>
  );
}
