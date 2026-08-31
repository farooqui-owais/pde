import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios.js";
import HeaderSarita from "../components/HeaderSarita.jsx";
import Footer from "../components/Footer.jsx";
import "./EntrySteps.css";

const ATTRIBUTE_TYPES = ["Survey Number", "C.T.S. Number", "Plot Number", "Gat Number", "Hissa Number"];
const AREA_UNITS = ["Square Foot", "Square Meter", "Acre", "Hectare", "Guntha"];

const BLANK = {
  district: "", village_name: "", urban_rural: "Urban",
  hadd_type: "", hadd_name: "", taluka: "", zp: "",
  attribute_type_1: "", attribute_value_1: "",
  attribute_type_2: "", attribute_value_2: "",
  area: "", area_unit: "Square Foot", property_type: "", pui_number: "",
  flat_no_en: "", flat_no_mr: "", floor_no_en: "", floor_no_mr: "",
  building_name_en: "", building_name_mr: "", block_sector_en: "", block_sector_mr: "",
  road_en: "", road_mr: "",
};

export default function PropertyDetails() {
  const { t } = useTranslation(["pages", "common"]);
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(BLANK);
  const [properties, setProperties] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [puiStatus, setPuiStatus] = useState(null);

  async function load() {
    try {
      const { data } = await api.get(`/api/documents/${id}/properties`);
      setProperties(data);
    } catch {
      setProperties([]);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function verifyPui() {
    if (!form.pui_number) return;
    try {
      const { data } = await api.post(`/api/documents/${id}/verify-pui`, { pui_number: form.pui_number });
      setPuiStatus(data.verified);
    } catch {
      setPuiStatus(false);
    }
  }

  async function handleAdd() {
    setError("");
    const attributes = [];
    if (form.attribute_type_1 && form.attribute_value_1) attributes.push({ type: form.attribute_type_1, value: form.attribute_value_1 });
    if (form.attribute_type_2 && form.attribute_value_2) attributes.push({ type: form.attribute_type_2, value: form.attribute_value_2 });
    if (attributes.length > 2) { setError(t("property.tooManyAttributes")); return; }

    setSaving(true);
    try {
      await api.post(`/api/documents/${id}/properties`, {
        district: form.district, village_name: form.village_name, urban_rural: form.urban_rural,
        hadd_type: form.hadd_type, hadd_name: form.hadd_name, taluka: form.taluka, zp: form.zp || null,
        attributes,
        area: form.area || null, area_unit: form.area_unit, property_type: form.property_type,
        pui_number: form.pui_number || null,
        flat_no_en: form.flat_no_en, flat_no_mr: form.flat_no_mr,
        floor_no_en: form.floor_no_en, floor_no_mr: form.floor_no_mr,
        building_name_en: form.building_name_en, building_name_mr: form.building_name_mr,
        block_sector_en: form.block_sector_en, block_sector_mr: form.block_sector_mr,
        road_en: form.road_en, road_mr: form.road_mr,
      });
      setForm(BLANK);
      setPuiStatus(null);
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || t("property.couldNotSave"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(propertyId) {
    try {
      await api.delete(`/api/documents/${id}/properties/${propertyId}`);
      await load();
    } catch { /* ignore */ }
  }

  function handleNext() {
    if (properties.length === 0) { setError(t("property.mustAdd")); return; }
    navigate(`/entries/${id}/parties`);
  }

  return (
    <div className="page-shell">
      <HeaderSarita />
      <div className="page-body entry-body">
        <h1 className="entry-title">{t("property.title")}</h1>
        <div className="entry-hint">{t("property.hint")}</div>
        <div className="entry-count">{t("property.count")} <b>{properties.length + 1}</b></div>

        {error && <div className="banner banner-error">{error}</div>}

        <div className="entry-grid">
          <label>{t("property.selectDistrict")}</label>
          <input value={form.district} onChange={(e) => update("district", e.target.value)} />
          <label>{t("property.villageName")}</label>
          <input value={form.village_name} onChange={(e) => update("village_name", e.target.value)} />

          <label>{t("property.urbanRural")}</label>
          <select value={form.urban_rural} onChange={(e) => update("urban_rural", e.target.value)}>
            <option value="Urban">Urban</option>
            <option value="Rural">Rural</option>
          </select>
          <label>{t("property.selectHaddType")}</label>
          <input value={form.hadd_type} onChange={(e) => update("hadd_type", e.target.value)} placeholder={t("property.haddTypePlaceholder")} />

          <label>{t("property.selectHaddName")}</label>
          <input value={form.hadd_name} onChange={(e) => update("hadd_name", e.target.value)} />
          <label>{t("property.selectTaluka")}</label>
          <input value={form.taluka} onChange={(e) => update("taluka", e.target.value)} />

          <label>{t("property.selectZP")}</label>
          <input value={form.zp} onChange={(e) => update("zp", e.target.value)} disabled={form.urban_rural !== "Rural"} placeholder={form.urban_rural === "Rural" ? "" : t("property.ruralOnly")} />
          <span /><span />

          <label>{t("property.attributeType1")}</label>
          <select value={form.attribute_type_1} onChange={(e) => update("attribute_type_1", e.target.value)}>
            <option value="">{t("property.selectOption")}</option>
            {ATTRIBUTE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <label>{t("property.value")}</label>
          <input value={form.attribute_value_1} onChange={(e) => update("attribute_value_1", e.target.value)} />

          <label>{t("property.attributeType2")}</label>
          <select value={form.attribute_type_2} onChange={(e) => update("attribute_type_2", e.target.value)}>
            <option value="">{t("property.selectOption")}</option>
            {ATTRIBUTE_TYPES.filter((t) => t !== form.attribute_type_1).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <label>{t("property.value")}</label>
          <input value={form.attribute_value_2} onChange={(e) => update("attribute_value_2", e.target.value)} />
          <span /><span className="entry-note-red">{t("property.max2Attributes")}</span>

          <label>{t("property.area")}</label>
          <input type="number" min="0" value={form.area} onChange={(e) => update("area", e.target.value)} />
          <label>{t("property.unit")}</label>
          <select value={form.area_unit} onChange={(e) => update("area_unit", e.target.value)}>
            {AREA_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>

          <label>{t("property.selectPropertyType")}</label>
          <input value={form.property_type} onChange={(e) => update("property_type", e.target.value)} placeholder={t("property.propTypePlaceholder")} />
          <span /><span />

          <label>{t("property.enterPui")}</label>
          <div className="verify-btn-row">
            <input value={form.pui_number} onChange={(e) => update("pui_number", e.target.value)} />
            <button type="button" className="btn btn-green" onClick={verifyPui}>{t("property.verifyPui")}</button>
            {puiStatus === true && <span className="verify-ok">{t("common:verified")}</span>}
            {puiStatus === false && <span className="verify-fail">{t("common:notVerified")}</span>}
          </div>
          <span /><span />

          <div className="section-heading"><span>{t("property.addrEnglish")}</span><span>{t("property.addrMarathi")}</span></div>

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
        </div>

        <div className="entry-actions">
          <button type="button" className="btn btn-blue" onClick={() => navigate(-1)}>{t("common:previous")}</button>
          <button type="button" className="btn btn-outline" onClick={() => setForm(BLANK)}>{t("common:cancel")}</button>
          <button type="button" className="btn btn-green" onClick={handleAdd} disabled={saving}>{saving ? t("common:saving") : t("property.saveEntity")}</button>
          <button type="button" className="btn btn-green" onClick={handleNext}>{t("common:next")}</button>
        </div>

        <div className="step-table-title">{t("property.tableTitle")}</div>
        <table className="step-table">
          <thead>
            <tr><th>{t("common:select")}</th><th>{t("common:delete")}</th><th>{t("property.colVillage")}</th><th>{t("property.colDistrict")}</th><th>{t("property.colUR")}</th><th>{t("property.colHaddType")}</th><th>{t("property.colTaluka")}</th><th>{t("property.colArea")}</th></tr>
          </thead>
          <tbody>
            {properties.length === 0 && <tr><td colSpan={8} style={{ color: "#777" }}>{t("property.noRows")}</td></tr>}
            {properties.map((p) => (
              <tr key={p.id}>
                <td><a href="#" onClick={(e) => e.preventDefault()}>{t("common:select")}</a></td>
                <td><a href="#" onClick={(e) => { e.preventDefault(); handleDelete(p.id); }}>{t("common:delete")}</a></td>
                <td>{p.village_name || "—"}</td>
                <td>{p.district || "—"}</td>
                <td>{p.urban_rural}</td>
                <td>{p.hadd_type || "—"}</td>
                <td>{p.taluka || "—"}</td>
                <td>{p.area || "—"} {p.area_unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Footer office={{ dig: "Pune", jdr: "Pune", sro: "Joint S.R. Haveli 14" }} />
    </div>
  );
}
