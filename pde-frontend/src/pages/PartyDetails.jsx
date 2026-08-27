import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
      setError("Provide a PAN number, or check 'Is Declaration Attached (Form 60/61)'.");
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
      setError(err?.response?.data?.detail || "Could not save this party.");
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
    if (parties.length === 0) { setError("Add at least one party before continuing."); return; }
    navigate(`/entries/${id}/identifications`);
  }

  return (
    <div className="page-shell">
      <HeaderSarita />
      <div className="page-body entry-body">
        <h1 className="entry-title">Party Details</h1>
        <div className="entry-count">Party Count: <b>{parties.length + 1}</b></div>

        {error && <div className="banner banner-error">{error}</div>}

        <div className="entry-grid">
          <label>Select Party Type</label>
          <select className="span2" value={form.party_type} onChange={(e) => update("party_type", e.target.value)}>
            <option value="">--Select Party Type--</option>
            {PARTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <span />

          <div className="section-heading"><span>Party Name in English</span><span>Party Name in Marathi</span></div>

          <label>Surname</label>
          <input value={form.surname_en} onChange={(e) => update("surname_en", e.target.value)} />
          <label>Surname (Marathi)</label>
          <input value={form.surname_mr} onChange={(e) => update("surname_mr", e.target.value)} />

          <label>First Name</label>
          <input value={form.first_name_en} onChange={(e) => update("first_name_en", e.target.value)} />
          <label>First Name (Marathi)</label>
          <input value={form.first_name_mr} onChange={(e) => update("first_name_mr", e.target.value)} />

          <label>Middle Name</label>
          <input value={form.middle_name_en} onChange={(e) => update("middle_name_en", e.target.value)} />
          <label>Middle Name (Marathi)</label>
          <input value={form.middle_name_mr} onChange={(e) => update("middle_name_mr", e.target.value)} />

          <label>Age</label>
          <input type="number" min="0" value={form.age} onChange={(e) => update("age", e.target.value)} />
          <span />
          <div className="checkbox-row">
            <input type="checkbox" checked={form.is_bank} onChange={(e) => update("is_bank", e.target.checked)} /> Is Bank
          </div>

          <span />
          <div className="checkbox-row">
            <input type="checkbox" checked={form.is_stamp_purchaser} onChange={(e) => update("is_stamp_purchaser", e.target.checked)} /> Is Stamp Purchaser
          </div>
          <div className="checkbox-row">
            <input type="checkbox" checked={form.is_presentor} onChange={(e) => update("is_presentor", e.target.checked)} /> Is Presentor
          </div>
          <span />

          <div className="section-heading"><span>Address (English)</span><span>Address (Marathi)</span></div>

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

          <label>Pin Code</label>
          <input value={form.pin_code} onChange={(e) => update("pin_code", e.target.value)} />
          <label>Country</label>
          <input value={form.country} onChange={(e) => update("country", e.target.value)} />

          <label>State</label>
          <input value={form.state_en} onChange={(e) => update("state_en", e.target.value)} />
          <label>City</label>
          <input value={form.city_en} onChange={(e) => update("city_en", e.target.value)} />

          <label>District Name</label>
          <input value={form.district_name} onChange={(e) => update("district_name", e.target.value)} />
          <span /><span />

          <label>UID (Aadhaar)</label>
          <input value={form.uid} onChange={(e) => update("uid", e.target.value)} />
          <label>Mobile Number</label>
          <input value={form.mobile_number} onChange={(e) => update("mobile_number", e.target.value)} />

          <label>Identification Mark1</label>
          <input value={form.identification_mark1} onChange={(e) => update("identification_mark1", e.target.value)} />
          <label>Identification Mark2</label>
          <input value={form.identification_mark2} onChange={(e) => update("identification_mark2", e.target.value)} />

          <label>Pan Card No.</label>
          <div className="verify-btn-row">
            <input value={form.pan_number} onChange={(e) => update("pan_number", e.target.value)} />
            <button type="button" className="btn btn-green" onClick={verifyPan}>Verify PAN Number</button>
            {panStatus === true && <span className="verify-ok">Verified</span>}
            {panStatus === false && <span className="verify-fail">Not verified</span>}
          </div>
          <div className="checkbox-row">
            <input type="checkbox" checked={form.declaration_form_60_61} onChange={(e) => update("declaration_form_60_61", e.target.checked)} />
            Is Declaration Attached (Form 60/61)
          </div>

          <label>Identification Proof</label>
          <select value={form.identification_proof} onChange={(e) => update("identification_proof", e.target.value)}>
            {ID_PROOFS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <label>Proof No.</label>
          <input value={form.identification_proof_number} onChange={(e) => update("identification_proof_number", e.target.value)} />

          <label>Email</label>
          <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
          <span /><span />

          <div className="checkbox-row">
            <input type="checkbox" checked={form.is_document_signed} onChange={(e) => update("is_document_signed", e.target.checked)} /> Is Document Signed
          </div>
          <div className="checkbox-row">
            <input type="checkbox" checked={form.is_exemption_section_88} onChange={(e) => update("is_exemption_section_88", e.target.checked)} /> Is Exemption Under Section 88
          </div>
          <span /><span />
        </div>

        <div className="entry-actions">
          <button type="button" className="btn btn-blue" onClick={() => navigate(`/entries/${id}/properties`)}>Previous</button>
          <button type="button" className="btn btn-outline" onClick={() => setForm(BLANK)}>Cancel</button>
          <button type="button" className="btn btn-green" onClick={handleAdd} disabled={saving}>{saving ? "Saving…" : "Save Party"}</button>
          <button type="button" className="btn btn-green" onClick={handleNext}>Next</button>
        </div>

        <div className="step-table-title">Party Details</div>
        <table className="step-table">
          <thead>
            <tr><th>Select</th><th>Delete</th><th>Type</th><th>Name</th><th>Age</th><th>PIN</th><th>PAN</th><th>Signed</th></tr>
          </thead>
          <tbody>
            {parties.length === 0 && <tr><td colSpan={8} style={{ color: "#777" }}>No parties added yet.</td></tr>}
            {parties.map((p) => (
              <tr key={p.id}>
                <td><a href="#" onClick={(e) => e.preventDefault()}>Select</a></td>
                <td><a href="#" onClick={(e) => { e.preventDefault(); handleDelete(p.id); }}>Delete</a></td>
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
