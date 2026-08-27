import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
    if (attributes.length > 2) { setError("Maximum 2 Attributes can be selected."); return; }

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
      setError(err?.response?.data?.detail || "Could not save this property.");
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
    if (properties.length === 0) { setError("Add at least one property before continuing."); return; }
    navigate(`/entries/${id}/parties`);
  }

  return (
    <div className="page-shell">
      <HeaderSarita />
      <div className="page-body entry-body">
        <h1 className="entry-title">Property Details</h1>
        <div className="entry-hint">Type In English get in Marathi &mdash; Kindly note down the 11 digit Token Number for any use in future.</div>
        <div className="entry-count">Property Count: <b>{properties.length + 1}</b></div>

        {error && <div className="banner banner-error">{error}</div>}

        <div className="entry-grid">
          <label>Select District</label>
          <input value={form.district} onChange={(e) => update("district", e.target.value)} />
          <label>Village Name</label>
          <input value={form.village_name} onChange={(e) => update("village_name", e.target.value)} />

          <label>Urban / Rural</label>
          <select value={form.urban_rural} onChange={(e) => update("urban_rural", e.target.value)}>
            <option value="Urban">Urban</option>
            <option value="Rural">Rural</option>
          </select>
          <label>Select Hadd Type</label>
          <input value={form.hadd_type} onChange={(e) => update("hadd_type", e.target.value)} placeholder="e.g. Corporation" />

          <label>Select Hadd Name</label>
          <input value={form.hadd_name} onChange={(e) => update("hadd_name", e.target.value)} />
          <label>Select Taluka</label>
          <input value={form.taluka} onChange={(e) => update("taluka", e.target.value)} />

          <label>Select ZP</label>
          <input value={form.zp} onChange={(e) => update("zp", e.target.value)} disabled={form.urban_rural !== "Rural"} placeholder={form.urban_rural === "Rural" ? "" : "Rural only"} />
          <span /><span />

          <label>Attribute Type 1</label>
          <select value={form.attribute_type_1} onChange={(e) => update("attribute_type_1", e.target.value)}>
            <option value="">--Select--</option>
            {ATTRIBUTE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <label>Value</label>
          <input value={form.attribute_value_1} onChange={(e) => update("attribute_value_1", e.target.value)} />

          <label>Attribute Type 2</label>
          <select value={form.attribute_type_2} onChange={(e) => update("attribute_type_2", e.target.value)}>
            <option value="">--Select--</option>
            {ATTRIBUTE_TYPES.filter((t) => t !== form.attribute_type_1).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <label>Value</label>
          <input value={form.attribute_value_2} onChange={(e) => update("attribute_value_2", e.target.value)} />
          <span /><span className="entry-note-red">(Maximum 2 Attributes can be selected.)</span>

          <label>Area</label>
          <input type="number" min="0" value={form.area} onChange={(e) => update("area", e.target.value)} />
          <label>Unit</label>
          <select value={form.area_unit} onChange={(e) => update("area_unit", e.target.value)}>
            {AREA_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>

          <label>Select Property Type</label>
          <input value={form.property_type} onChange={(e) => update("property_type", e.target.value)} placeholder="e.g. Land+Residential" />
          <span /><span />

          <label>Enter PUI Number / Property Tax No.</label>
          <div className="verify-btn-row">
            <input value={form.pui_number} onChange={(e) => update("pui_number", e.target.value)} />
            <button type="button" className="btn btn-green" onClick={verifyPui}>Verify PUI</button>
            {puiStatus === true && <span className="verify-ok">Verified</span>}
            {puiStatus === false && <span className="verify-fail">Not verified</span>}
          </div>
          <span /><span />

          <div className="section-heading"><span>Property Address (English)</span><span>Property Address (Marathi)</span></div>

          <label>Flat No.</label>
          <input value={form.flat_no_en} onChange={(e) => update("flat_no_en", e.target.value)} />
          <label>Flat No. (Marathi)</label>
          <input value={form.flat_no_mr} onChange={(e) => update("flat_no_mr", e.target.value)} />

          <label>Floor No.</label>
          <input value={form.floor_no_en} onChange={(e) => update("floor_no_en", e.target.value)} />
          <label>Floor No. (Marathi)</label>
          <input value={form.floor_no_mr} onChange={(e) => update("floor_no_mr", e.target.value)} />

          <label>Building Name</label>
          <input value={form.building_name_en} onChange={(e) => update("building_name_en", e.target.value)} />
          <label>Building Name (Marathi)</label>
          <input value={form.building_name_mr} onChange={(e) => update("building_name_mr", e.target.value)} />

          <label>Block Sector Location</label>
          <input value={form.block_sector_en} onChange={(e) => update("block_sector_en", e.target.value)} />
          <label>Block Sector (Marathi)</label>
          <input value={form.block_sector_mr} onChange={(e) => update("block_sector_mr", e.target.value)} />

          <label>Road</label>
          <input value={form.road_en} onChange={(e) => update("road_en", e.target.value)} />
          <label>Road (Marathi)</label>
          <input value={form.road_mr} onChange={(e) => update("road_mr", e.target.value)} />
        </div>

        <div className="entry-actions">
          <button type="button" className="btn btn-blue" onClick={() => navigate(-1)}>Previous</button>
          <button type="button" className="btn btn-outline" onClick={() => setForm(BLANK)}>Cancel</button>
          <button type="button" className="btn btn-green" onClick={handleAdd} disabled={saving}>{saving ? "Saving…" : "Save Property"}</button>
          <button type="button" className="btn btn-green" onClick={handleNext}>Next</button>
        </div>

        <div className="step-table-title">Property Details</div>
        <table className="step-table">
          <thead>
            <tr><th>Select</th><th>Delete</th><th>Village</th><th>District</th><th>U/R</th><th>Hadd Type</th><th>Taluka</th><th>Area</th></tr>
          </thead>
          <tbody>
            {properties.length === 0 && <tr><td colSpan={8} style={{ color: "#777" }}>No properties added yet.</td></tr>}
            {properties.map((p) => (
              <tr key={p.id}>
                <td><a href="#" onClick={(e) => e.preventDefault()}>Select</a></td>
                <td><a href="#" onClick={(e) => { e.preventDefault(); handleDelete(p.id); }}>Delete</a></td>
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
