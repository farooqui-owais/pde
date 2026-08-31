import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios.js";
import HeaderSarita from "../components/HeaderSarita.jsx";
import Footer from "../components/Footer.jsx";
import "./EntrySteps.css";

const ID_PROOFS = ["Aadhar Card", "PAN Card", "Passport", "Voter ID", "Driving Licence"];

const BLANK = {
  surname_en: "", first_name_en: "", middle_name_en: "",
  surname_mr: "", first_name_mr: "", middle_name_mr: "",
  address_en: "", address_mr: "", age: "", pin_code: "",
  identification_proof: "Aadhar Card", proof_number: "",
};

export default function IdentificationDetails() {
  const { t } = useTranslation(["pages", "common"]);
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(BLANK);
  const [identifications, setIdentifications] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const { data } = await api.get(`/api/documents/${id}/identifications`);
      setIdentifications(data);
    } catch { setIdentifications([]); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleAdd() {
    setError("");
    setSaving(true);
    try {
      await api.post(`/api/documents/${id}/identifications`, {
        ...form,
        age: form.age ? Number(form.age) : null,
      });
      setForm(BLANK);
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || t("identification.couldNotSave"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(identId) {
    try {
      await api.delete(`/api/documents/${id}/identifications/${identId}`);
      await load();
    } catch { /* ignore */ }
  }

  function handleViewReport() {
    if (identifications.length === 0) { setError(t("identification.mustAdd")); return; }
    navigate(`/entries/${id}/report`);
  }

  return (
    <div className="page-shell">
      <HeaderSarita />
      <div className="page-body entry-body">
        <h1 className="entry-title">{t("identification.title")}</h1>
        <div className="entry-hint">{t("identification.hint")}</div>
        <div className="entry-count">{t("identification.count")} <b>{identifications.length + 1}</b></div>

        {error && <div className="banner banner-error">{error}</div>}

        <div className="entry-grid">
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

          <label>{t("common:address")}</label>
          <textarea rows={2} value={form.address_en} onChange={(e) => update("address_en", e.target.value)} />
          <label>{t("identification.addressMr")}</label>
          <textarea rows={2} value={form.address_mr} onChange={(e) => update("address_mr", e.target.value)} />

          <label>{t("common:age")}</label>
          <input type="number" min="0" value={form.age} onChange={(e) => update("age", e.target.value)} />
          <label>{t("common:pinCode")}</label>
          <input value={form.pin_code} onChange={(e) => update("pin_code", e.target.value)} />

          <label>{t("party.identificationProof")}</label>
          <select value={form.identification_proof} onChange={(e) => update("identification_proof", e.target.value)}>
            {ID_PROOFS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <label>{t("party.proofNo")}</label>
          <input value={form.proof_number} onChange={(e) => update("proof_number", e.target.value)} />
        </div>

        <div className="entry-actions">
          <button type="button" className="btn btn-blue" onClick={() => navigate(`/entries/${id}/parties`)}>{t("common:previous")}</button>
          <button type="button" className="btn btn-outline" onClick={() => setForm(BLANK)}>{t("common:cancel")}</button>
          <button type="button" className="btn btn-green" onClick={handleAdd} disabled={saving}>{saving ? t("common:saving") : t("identification.saveEntity")}</button>
          <button type="button" className="btn btn-green" onClick={handleViewReport}>{t("identification.viewReport")}</button>
        </div>

        <div className="step-table-title">{t("identification.tableTitle")}</div>
        <table className="step-table">
          <thead>
            <tr><th>{t("common:select")}</th><th>{t("common:delete")}</th><th>{t("identification.colSurname")}</th><th>{t("identification.colFirstName")}</th><th>{t("common:age")}</th><th>{t("identification.colAddress")}</th><th>{t("identification.colProof")}</th></tr>
          </thead>
          <tbody>
            {identifications.length === 0 && <tr><td colSpan={7} style={{ color: "#777" }}>{t("identification.noRows")}</td></tr>}
            {identifications.map((i) => (
              <tr key={i.id}>
                <td><a href="#" onClick={(e) => e.preventDefault()}>{t("common:select")}</a></td>
                <td><a href="#" onClick={(e) => { e.preventDefault(); handleDelete(i.id); }}>{t("common:delete")}</a></td>
                <td>{i.surname_en || "—"}</td>
                <td>{i.first_name_en || "—"}</td>
                <td>{i.age ?? "—"}</td>
                <td>{i.address_en || "—"}</td>
                <td>{i.identification_proof} {i.proof_number}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Footer office={{ dig: "Pune", jdr: "Pune", sro: "Joint S.R. Haveli 14" }} />
    </div>
  );
}
