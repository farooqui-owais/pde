import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../api/axios.js";
import { validateStampPaymentForm } from "../utils/validation.js";
import "./StampPaymentModal.css";

const PAID_BY_OPTIONS = [
  { value: "Franking", label: "\u092b\u094d\u0930\u0901\u0915\u093f\u0902\u0917" },       // फ्रँकिंग
  { value: "Stamp Paper", label: "\u0938\u094d\u091f\u0945\u0902\u092a \u092a\u0947\u092a\u0930" }, // स्टॅम्प पेपर
  { value: "Certificate", label: "\u092a\u094d\u0930\u092e\u093e\u0923\u092a\u0924\u094d\u0930" },  // प्रमाणपत्र
  { value: "e-Stamp", label: "\u0908 \u0938\u094d\u091f\u0945\u092e\u094d\u092a" },        // ई स्टॅम्प
  { value: "e-SBTR", label: "\u0908 \u090f\u0938.\u092c\u0940.\u091f\u0940.\u0906\u0930" }, // ई एस.बी.टी.आर
  { value: "e-Challan", label: "\u0908 \u091a\u0932\u093e\u0928" },                        // ई चलान
];

const todayDdmmyyyy = new Date().toLocaleDateString("en-GB");
const todayIso = new Date().toISOString().slice(0, 10);

export default function StampPaymentModal({ documentEntryId, defaultAmount, onClose }) {
  const { t } = useTranslation(["validation"]);
  const [paidBy, setPaidBy] = useState("Franking");
  const [form, setForm] = useState({
    franking_mc_no: "",
    vendors_name: "",
    franking_serial_no: "",
    payment_date: todayIso,
    amount: defaultAmount || "",
    licence_no: "",
    serial_no: "",
    stationery_number: "",
  });
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadPayments() {
    try {
      const { data } = await api.get(`/api/stamp/payments/${documentEntryId}`);
      setPayments(data);
    } catch {
      setPayments([]);
    }
  }

  useEffect(() => {
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentEntryId]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    setError("");
    const validationError = validateStampPaymentForm(form);
    if (validationError) { setError(t(validationError)); return; }
    setSaving(true);
    try {
      const payload = {
        document_entry_id: documentEntryId,
        paid_by: paidBy,
        amount: form.amount,
        payment_date: form.payment_date || null,
        franking_mc_no: paidBy === "Franking" ? form.franking_mc_no : null,
        franking_serial_no: paidBy === "Franking" ? form.franking_serial_no : null,
        licence_no: paidBy !== "Franking" ? form.licence_no : null,
        serial_no: ["Stamp Paper", "Certificate"].includes(paidBy) ? form.serial_no : null,
        vendors_name: ["Franking", "Stamp Paper", "Certificate"].includes(paidBy) ? form.vendors_name : null,
        stationery_number: paidBy === "e-SBTR" ? form.stationery_number : null,
      };
      await api.post("/api/stamp/payments", payload);
      await loadPayments();
      setForm((f) => ({ ...f, franking_serial_no: "", licence_no: "", serial_no: "", amount: "", stationery_number: "" }));
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not save this stamp payment.");
    } finally {
      setSaving(false);
    }
  }

  function renderFields() {
    switch (paidBy) {
      case "Franking":
        return (
          <>
            <label>Franking M/C No.</label>
            <input value={form.franking_mc_no || ""} onChange={(e) => update("franking_mc_no", e.target.value)} />
            <span /><span />

            <label>Vendor's Name</label>
            <input value={form.vendors_name || ""} disabled />
            <span /><span />

            <label>Franking Serial No.</label>
            <input value={form.franking_serial_no || ""} onChange={(e) => update("franking_serial_no", e.target.value)} />
            <span className="stamp-multi-note">Multiple Franking / Mudrank, Separated.</span><span />

            <label>Franking Date</label>
            <input type="date" value={form.payment_date || ""} onChange={(e) => update("payment_date", e.target.value)} />
            <span /><span />

            <label>Franking Amount</label>
            <input value={form.amount} onChange={(e) => update("amount", e.target.value)} />
            <span /><span />
          </>
        );
      case "e-Stamp":
        return (
          <>
            <label>ACC No.</label>
            <input value={form.licence_no || ""} onChange={(e) => update("licence_no", e.target.value)} />
            <span /><span />

            <label>eStamp Amount</label>
            <input value={form.amount} onChange={(e) => update("amount", e.target.value)} />
            <span /><span />
          </>
        );
      case "e-SBTR":
        return (
          <>
            <label>eSBTR (GRN) No.</label>
            <input value={form.licence_no || ""} onChange={(e) => update("licence_no", e.target.value)} />
            <span /><span />

            <label>eSBTR Amount</label>
            <input value={form.amount} onChange={(e) => update("amount", e.target.value)} />
            <span /><span />

            <label>Stationary Number</label>
            <input value={form.stationery_number || ""} onChange={(e) => update("stationery_number", e.target.value)} />
            <span /><span />
          </>
        );
      case "e-Challan":
        return (
          <>
            <label>GRN No.</label>
            <input value={form.licence_no || ""} onChange={(e) => update("licence_no", e.target.value)} />
            <span /><span />

            <label>GRN Amount</label>
            <input value={form.amount} onChange={(e) => update("amount", e.target.value)} />
            <span /><span />
          </>
        );
      case "Certificate":
        return (
          <>
            <label>Collector of Stamps Number</label>
            <input value={form.licence_no || ""} onChange={(e) => update("licence_no", e.target.value)} />
            <span /><span />

            <label>Collector of Stamps</label>
            <input value={form.vendors_name || ""} disabled />
            <span /><span />

            <label>Certificate Number</label>
            <input value={form.serial_no || ""} onChange={(e) => update("serial_no", e.target.value)} />
            <span /><span />

            <label>Certificate Date</label>
            <input type="date" value={form.payment_date || ""} onChange={(e) => update("payment_date", e.target.value)} />
            <span /><span />

            <label>Certificate Amount</label>
            <input value={form.amount} onChange={(e) => update("amount", e.target.value)} />
            <span /><span />
          </>
        );
      case "Stamp Paper":
      default:
        return (
          <>
            <label>Licence No.</label>
            <input value={form.licence_no || ""} onChange={(e) => update("licence_no", e.target.value)} />
            <span /><span />

            <label>Vendor's Name</label>
            <input value={form.vendors_name || ""} disabled />
            <span /><span />

            <label>Serial No.</label>
            <input value={form.serial_no || ""} onChange={(e) => update("serial_no", e.target.value)} />
            <span className="stamp-multi-note">Multiple Franking / Mudrank, Separated.</span><span />

            <label>Mudrank Date</label>
            <input type="date" value={form.payment_date || ""} onChange={(e) => update("payment_date", e.target.value)} />
            <span /><span />

            <label>Mudrank Amount</label>
            <input value={form.amount} onChange={(e) => update("amount", e.target.value)} />
            <span /><span />
          </>
        );
    }
  }

  return (
    <div className="stamp-modal-backdrop" onClick={onClose}>
      <div className="stamp-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="stamp-modal-title">Details of Stamp Payment</h2>
        <div className="stamp-modal-body">
          {error && <div className="banner banner-error">{error}</div>}

          <div className="stamp-grid">
            <label>Stamp Duty Paid By</label>
            <select value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
              {PAID_BY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <label>Stamp Duty</label>
            <input value={form.amount} onChange={(e) => update("amount", e.target.value)} />

            {renderFields()}
          </div>

          <div className="stamp-modal-actions">
            <button type="button" className="btn btn-blue" onClick={() => setForm((f) => ({ ...f, franking_serial_no: "", licence_no: "", serial_no: "" }))}>
              Add/\u0928\u0935\u0940\u0928
            </button>
            <button type="button" className="btn btn-green" onClick={handleSave} disabled={saving}>
              {saving ? "Saving\u2026" : "Save/\u0938\u093e\u0920\u0935\u093e"}
            </button>
            <button type="button" className="btn btn-red" onClick={onClose}>Close/\u092c\u0902\u0926</button>
          </div>

          <div className="stamp-table-title">Details of Stamps</div>
          <table className="stamp-table">
            <thead>
              <tr>
                <th>Select</th><th>Delete</th><th>Type</th><th>Vendor</th>
                <th>Amount</th><th>Date</th><th>Serial/MC No.</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && (
                <tr><td colSpan={7} style={{ color: "#777" }}>No stamp payments added yet.</td></tr>
              )}
              {payments.map((p) => (
                <tr key={p.id}>
                  <td><a href="#" onClick={(e) => e.preventDefault()}>Select</a></td>
                  <td><a href="#" onClick={(e) => { e.preventDefault(); handleDelete(p.id); }}>Delete</a></td>
                  <td>{p.paid_by}</td>
                  <td>{p.vendors_name || "\u2014"}</td>
                  <td>{p.amount}</td>
                  <td>{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : "\u2014"}</td>
                  <td>{p.franking_serial_no || p.serial_no || p.franking_mc_no || "\u2014"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
