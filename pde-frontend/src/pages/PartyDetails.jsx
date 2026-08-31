import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios.js";
import HeaderSarita from "../components/HeaderSarita.jsx";
import Footer from "../components/Footer.jsx";
import "./EntrySteps.css";

const PARTY_TYPES = ["Seller/Vendor", "Purchaser", "Bank/Financial Institution", "Power of Attorney Holder", "Witness Party"];
const ID_PROOFS = ["Aadhar Card", "PAN Card", "Passport", "Voter ID", "Driving Licence"];

const BLANK = {
  party_type: "", surname_en: "", first_name_en: "", middle_name_en: "",
  surname_mr: "", first_name_mr: "", middle_name_mr: "", age: "",
  is_bank: false, is_stamp_purchaser: false, is_presentor: false,
  flat_no_en: "", flat_no_mr: "", floor_no_en: "", floor_no_mr: "",
  building_name_en: "", building_name_mr: "", block_sector_en: "", block_sector_mr: "",
  road_en: "", road_mr: "", pin_code: "", country: "India",
  state_en: "", city_en: "", district_name: "",
  uid: "", mobile_number: "", identification_mark1: "", identification_mark2: "",
  pan_number: "", declaration_form_60_61: false,
  identification_proof: "Aadhar Card", identification_proof_number: "",
  email: "", is_document_signed: true, is_exemption_section_88: false,
};

export default function PartyDetails() {
  const { t } = useTranslation(["pages", "common"]);
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(BLANK);
  const [parties, setParties] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [panStatus, setPanStatus] = useState(null);

  async function load() {
    try {
      const { data } = await api.get(`/api/documents/${id}/parties`);
      setParties(data);
    } catch { setParties([]); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function verifyPan() {
    if (!form.pan_number) return;
    try {
      const { data } = await api.post(`/api/documents/${id}/verify-pan`, { pan_number: form.pan_number });
      setPanStatus(data.verified);
    } catch { setPanStatus(false); }
  }

  async function handleAdd() {
    setError("");
    if (!form.pan_number && !form.declaration_form_60_61) {
      setError(t("party.needPanOrDecl"));
      return;
    }
    setSaving(true);
    try {
      await api.post(`/api/documents/${id}/parties`, {
        ...form,
        age: form.age ? Number(form.age) : null,
      });
      setForm(BLANK);
      setPanStatus(null);
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || t("party.couldNotSave"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(partyId) {
    try {
      await api.delete(`/api/documents/${id}/parties/${partyId}`);
      await load();
    } catch { /* ignore */ }
  }

  function handleNext() {
    if (parties.length === 0) { setError(t("party.mustAdd")); return; }
    navigate(`/entries/${id}/identifications`);
  }

  return (
    <div className="page-shell">
      <HeaderSarita />
      <div className="page-body entry-body">
        <h1 className="entry-title">{t("party.title")}</h1>
        <div className="entry-count">{t("party.count")} <b>{parties.length + 1}</b></div>

        {error && <div className="banner banner-error">{error}</div>}

        <div className="entry-grid">
          <label>{t("party.selectPartyType")}</label>
          <select className="span2" value={form.party_type} onChange={(e) => update("party_type", e.target.value)}>
            <option value="">{t("party.selectPartyTypeOption")}</option>
            {PARTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <span />

          <div className="section-heading"><span>{t("party.nameEnglish")}</span><span>{t("party.nameMarathi")}</span></div>

          <label>{t("common:surname")}</label>
          <input value={form.surname_en} onChange={(e) => update("surname_en", e.target.value)} />
          <label>{t("party.surnameMr")}</label>
          <input value={form.surname_mr} onChange={(e) => update("surname_mr", e.target.value)} />

          <label>{t("common:firstName")}</label>
          <input value={form.first_name_en} onChange={(e) => update("first_name_en", e.target.value)} />
          <label>{t("party.firstNameMr")}</label>
          <input value={form.first_name_mr} onChange={(e) => update("first_name_mr", e.target.value)} />

          <label>{t("common:middleName")}</label>
          <input value={form.middle_name_en} onChange={(e) => update("middle_name_en", e.target.value)} />
          <label>{t("party.middleNameMr")}</label>
          <input value={form.middle_name_mr} onChange={(e) => update("middle_name_mr", e.target.value)} />

          <label>{t("common:age")}</label>
          <input type="number" min="0" value={form.age} onChange={(e) => update("age", e.target.value)} />
          <span />
          <div className="checkbox-row">
            <input type="checkbox" checked={form.is_bank} onChange={(e) => update("is_bank", e.target.checked)} /> {t("party.isBank")}
          </div>

          <span />
          <div className="checkbox-row">
            <input type="checkbox" checked={form.is_stamp_purchaser} onChange={(e) => update("is_stamp_purchaser", e.target.checked)} /> {t("party.isStampPurchaser")}
          </div>
          <div className="checkbox-row">
            <input type="checkbox" checked={form.is_presentor} onChange={(e) => update("is_presentor", e.target.checked)} /> {t("party.isPresentor")}
          </div>
          <span />

          <div className="section-heading"><span>{t("party.addrEnglish")}</span><span>{t("party.addrMarathi")}</span></div>

          <label>{t("property.flatNo")}</label>
          <input value={form.flat_no_en} onChange={(e) => update("flat_no_en", e.target.value)} />
          <label>{t("property.flatNoMr")}</label>
          <input value={form.flat_no_mr} onChange={(e) => update("flat_no_mr", e.target.value)} />

          <label>{t("property.floorNo")}</label>
          <input value={form.floor_no_en} onChange={(e) => update("floor_no_en", e.target.value)} />
          <label>{t("property.floorNoMr")}</label>
          <input value={form.floor_no_mr} onChange={(e) => update("floor_no_mr", e.target.value)} />

          <label>{t("property.buildingName")}</label>
          <input value={form.building_name_en} onChange={(e) => update("building_name_en", e.target.value)} />
          <label>{t("property.buildingNameMr")}</label>
          <input value={form.building_name_mr} onChange={(e) => update("building_name_mr", e.target.value)} />

          <label>{t("property.blockSector")}</label>
          <input value={form.block_sector_en} onChange={(e) => update("block_sector_en", e.target.value)} />
          <label>{t("property.blockSectorMr")}</label>
          <input value={form.block_sector_mr} onChange={(e) => update("block_sector_mr", e.target.value)} />

          <label>{t("property.road")}</label>
          <input value={form.road_en} onChange={(e) => update("road_en", e.target.value)} />
          <label>{t("property.roadMr")}</label>
          <input value={form.road_mr} onChange={(e) => update("road_mr", e.target.value)} />

          <label>{t("party.pinCode")}</label>
          <input value={form.pin_code} onChange={(e) => update("pin_code", e.target.value)} />
          <label>{t("party.country")}</label>
          <input value={form.country} onChange={(e) => update("country", e.target.value)} />

          <label>{t("party.state")}</label>
          <input value={form.state_en} onChange={(e) => update("state_en", e.target.value)} />
          <label>{t("party.city")}</label>
          <input value={form.city_en} onChange={(e) => update("city_en", e.target.value)} />

          <label>{t("party.districtName")}</label>
          <input value={form.district_name} onChange={(e) => update("district_name", e.target.value)} />
          <span /><span />

          <label>{t("party.uid")}</label>
          <input value={form.uid} onChange={(e) => update("uid", e.target.value)} />
          <label>{t("party.mobileNumber")}</label>
          <input value={form.mobile_number} onChange={(e) => update("mobile_number", e.target.value)} />

          <label>{t("party.idMark1")}</label>
          <input value={form.identification_mark1} onChange={(e) => update("identification_mark1", e.target.value)} />
          <label>{t("party.idMark2")}</label>
          <input value={form.identification_mark2} onChange={(e) => update("identification_mark2", e.target.value)} />

          <label>{t("party.panCardNo")}</label>
          <div className="verify-btn-row">
            <input value={form.pan_number} onChange={(e) => update("pan_number", e.target.value)} />
            <button type="button" className="btn btn-green" onClick={verifyPan}>{t("party.verifyPan")}</button>
            {panStatus === true && <span className="verify-ok">{t("common:verified")}</span>}
            {panStatus === false && <span className="verify-fail">{t("common:notVerified")}</span>}
          </div>
          <div className="checkbox-row">
            <input type="checkbox" checked={form.declaration_form_60_61} onChange={(e) => update("declaration_form_60_61", e.target.checked)} />
            {t("party.declaration60_61")}
          </div>

          <label>{t("party.identificationProof")}</label>
          <select value={form.identification_proof} onChange={(e) => update("identification_proof", e.target.value)}>
            {ID_PROOFS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <label>{t("party.proofNo")}</label>
          <input value={form.identification_proof_number} onChange={(e) => update("identification_proof_number", e.target.value)} />

          <label>{t("party.email")}</label>
          <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
          <span /><span />

          <div className="checkbox-row">
            <input type="checkbox" checked={form.is_document_signed} onChange={(e) => update("is_document_signed", e.target.checked)} /> {t("party.isDocumentSigned")}
          </div>
          <div className="checkbox-row">
            <input type="checkbox" checked={form.is_exemption_section_88} onChange={(e) => update("is_exemption_section_88", e.target.checked)} /> {t("party.isExemption88")}
          </div>
          <span /><span />
        </div>

        <div className="entry-actions">
          <button type="button" className="btn btn-blue" onClick={() => navigate(`/entries/${id}/properties`)}>{t("common:previous")}</button>
          <button type="button" className="btn btn-outline" onClick={() => setForm(BLANK)}>{t("common:cancel")}</button>
          <button type="button" className="btn btn-green" onClick={handleAdd} disabled={saving}>{saving ? t("common:saving") : t("party.saveEntity")}</button>
          <button type="button" className="btn btn-green" onClick={handleNext}>{t("common:next")}</button>
        </div>

        <div className="step-table-title">{t("party.tableTitle")}</div>
        <table className="step-table">
          <thead>
            <tr><th>{t("common:select")}</th><th>{t("common:delete")}</th><th>{t("party.colType")}</th><th>{t("party.colName")}</th><th>{t("common:age")}</th><th>{t("party.colPIN")}</th><th>{t("party.colPAN")}</th><th>{t("party.colSigned")}</th></tr>
          </thead>
          <tbody>
            {parties.length === 0 && <tr><td colSpan={8} style={{ color: "#777" }}>{t("party.noRows")}</td></tr>}
            {parties.map((p) => (
              <tr key={p.id}>
                <td><a href="#" onClick={(e) => e.preventDefault()}>{t("common:select")}</a></td>
                <td><a href="#" onClick={(e) => { e.preventDefault(); handleDelete(p.id); }}>{t("common:delete")}</a></td>
                <td>{p.party_type || "—"}</td>
                <td>{p.first_name_en} {p.surname_en}</td>
                <td>{p.age ?? "—"}</td>
                <td>{p.pin_code || "—"}</td>
                <td>{p.pan_number || "—"}</td>
                <td>{p.is_document_signed ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Footer office={{ dig: "Pune", jdr: "Pune", sro: "Joint S.R. Haveli 14" }} />
    </div>
  );
}
