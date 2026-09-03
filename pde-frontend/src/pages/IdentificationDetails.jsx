import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios.js";
import HeaderSarita from "../components/HeaderSarita.jsx";
import Footer from "../components/Footer.jsx";
import { formatApiValidationError, validateWitnessForm } from "../utils/validation.js";
import "./EntrySteps.css";

const ID_PROOFS = ["Aadhar Card", "PAN Card", "Passport", "Voter ID", "Driving Licence"];

const BLANK = {
  surname_en: "", first_name_en: "", middle_name_en: "",
  surname_mr: "", first_name_mr: "", middle_name_mr: "",
  address_en: "", address_mr: "",
  age: "", pin_code: "",
  identification_proof: "Aadhar Card", proof_number: "",
};

export default function IdentificationDetails() {
  const { t } = useTranslation(["pages", "common", "validation"]);
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(BLANK);
  const [records, setRecords] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const { data } = await api.get(`/api/documents/${id}/identifications`);
      setRecords(data);
    } catch {
      setRecords([]);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSelectRow(item) {
    setSelectedId(item.id);
    setForm({
      surname_en: item.surname_en || "",
      first_name_en: item.first_name_en || "",
      middle_name_en: item.middle_name_en || "",
      surname_mr: item.surname_mr || "",
      first_name_mr: item.first_name_mr || "",
      middle_name_mr: item.middle_name_mr || "",
      address_en: item.address_en || "",
      address_mr: item.address_mr || "",
      age: item.age != null ? String(item.age) : "",
      pin_code: item.pin_code || "",
      identification_proof: item.identification_proof || "Aadhar Card",
      proof_number: item.proof_number || "",
    });
  }

  function handleCancelEdit() {
    setSelectedId(null);
    setForm(BLANK);
    setError("");
  }

  async function handleSaveOrUpdate() {
    setError("");
    const validationError = validateWitnessForm(form);
    if (validationError) {
      setError(t(validationError));
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      age: form.age ? Number(form.age) : null,
    };
    try {
      if (selectedId) {
        await api.put(`/api/documents/${id}/identifications/${selectedId}`, payload);
      } else {
        await api.post(`/api/documents/${id}/identifications`, payload);
      }
      handleCancelEdit();
      await load();
    } catch (err) {
      setError(formatApiValidationError(err?.response?.data?.detail, t) || t("identification.couldNotSave"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(recordId) {
    if (!window.confirm(t("common:delete") + "?")) return;
    try {
      await api.delete(`/api/documents/${id}/identifications/${recordId}`);
      if (selectedId === recordId) handleCancelEdit();
      await load();
    } catch {
      /* ignore */
    }
  }

  function handleNext() {
    if (records.length === 0) {
      setError(t("identification.mustAdd"));
      return;
    }
    navigate(`/entries/${id}/digital-submission`);
  }

  return (
    <div className="page-shell">
      <HeaderSarita />
      <div className="page-body entry-body">
        <h1 className="entry-title">{t("identification.title")}</h1>
        <p className="entry-hint">{t("identification.hint")}</p>
        <div className="entry-count">{t("identification.count")} <b>{records.length + 1}</b></div>

        {error && <div className="banner banner-error">{error}</div>}

        <div className="entry-grid">
          <label>{t("identification.identificationCount") || "Identification Count"}</label>
          <input value={records.length + 1} readOnly style={{ backgroundColor: "#edf2f7" }} />
          <span />

          <div className="section-heading"><span>{t("identification.nameEnglish")}</span><span>{t("identification.nameMarathi")}</span></div>

          <label>{t("common:surname")}</label>
          <input value={form.surname_en} onChange={(e) => update("surname_en", e.target.value)} />
          <label>{t("identification.surnameMr")}</label>
          <input value={form.surname_mr} onChange={(e) => update("surname_mr", e.target.value)} />

          <label>{t("common:firstName")}</label>
          <input value={form.first_name_en} onChange={(e) => update("first_name_en", e.target.value)} />
          <label>{t("identification.firstNameMr")}</label>
          <input value={form.first_name_mr} onChange={(e) => update("first_name_mr", e.target.value)} />

          <label>{t("common:middleName")}</label>
          <input value={form.middle_name_en} onChange={(e) => update("middle_name_en", e.target.value)} />
          <label>{t("identification.middleNameMr")}</label>
          <input value={form.middle_name_mr} onChange={(e) => update("middle_name_mr", e.target.value)} />

          <label>{t("identification.address")}</label>
          <textarea rows={2} value={form.address_en} onChange={(e) => update("address_en", e.target.value)} />
          <label>{t("identification.addressMr")}</label>
          <textarea rows={2} value={form.address_mr} onChange={(e) => update("address_mr", e.target.value)} />

          <label>{t("common:age")}</label>
          <input type="number" min="0" value={form.age} onChange={(e) => update("age", e.target.value)} />
          <label>{t("common:pinCode")}</label>
          <input value={form.pin_code} onChange={(e) => update("pin_code", e.target.value)} />

          <label>{t("identification.colProof")}</label>
          <select value={form.identification_proof} onChange={(e) => update("identification_proof", e.target.value)}>
            {ID_PROOFS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <label>{t("party.proofNo")}</label>
          <input value={form.proof_number} onChange={(e) => update("proof_number", e.target.value)} />
        </div>

        <div className="entry-actions">
          <button type="button" className="btn btn-blue" onClick={() => navigate(`/entries/${id}/parties`)}>{t("common:previous")}</button>
          <button type="button" className="btn btn-outline" onClick={handleCancelEdit}>{t("common:cancel")}</button>
          <button type="button" className="btn btn-green" onClick={handleSaveOrUpdate} disabled={saving}>
            {saving ? t("common:saving") : t("identification.saveEntity")}
          </button>
          <button type="button" className="btn btn-green" onClick={handleNext}>{t("common:next")}</button>
        </div>

        <div className="step-table-title">{t("identification.tableTitle")}</div>
        <table className="step-table">
          <thead>
            <tr>
              <th>{t("common:select")}</th>
              <th>{t("common:delete")}</th>
              <th>{t("identification.colSurname")}</th>
              <th>{t("identification.colFirstName")}</th>
              <th>{t("common:age")}</th>
              <th>{t("identification.colAddress")}</th>
              <th>{t("common:pinCode")}</th>
              <th>{t("identification.colProof")}</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && <tr><td colSpan={8} style={{ color: "#777" }}>{t("identification.noRows")}</td></tr>}
            {records.map((item) => (
              <tr key={item.id}>
                <td><a href="#" onClick={(e) => { e.preventDefault(); handleSelectRow(item); }}>{t("common:select")}</a></td>
                <td><a href="#" onClick={(e) => { e.preventDefault(); handleDelete(item.id); }}>{t("common:delete")}</a></td>
                <td>{item.surname_mr || item.surname_en || "—"}</td>
                <td>{item.first_name_mr || item.first_name_en || "—"}</td>
                <td>{item.age ?? "—"}</td>
                <td>{item.address_mr || item.address_en || "—"}</td>
                <td>{item.pin_code || "—"}</td>
                <td>{item.identification_proof || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Footer />
    </div>
  );
}
