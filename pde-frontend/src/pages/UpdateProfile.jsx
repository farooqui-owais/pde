import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios.js";
import HeaderTeal from "../components/HeaderTeal.jsx";
import Footer from "../components/Footer.jsx";
import "./Register.css";

const FIELDS = [
  "title", "first_name", "middle_name", "last_name",
  "mobile_number", "landline_number", "email", "alternate_email", "pan_number",
  "pin_code", "state", "district_name", "city",
  "house_no", "building_name", "road_street", "area_locality",
];

export default function UpdateProfile() {
  const navigate = useNavigate();

  // A direct visit without going through the Dashboard "Update Profile" ->
  // password-confirm modal shouldn't land here.
  useEffect(() => {
    if (sessionStorage.getItem("dn_profile_unlock") !== "1") {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/api/auth/me").then(({ data }) => {
      const next = {};
      FIELDS.forEach((f) => { next[f] = data[f] ?? ""; });
      setForm(next);
    }).catch(() => setError("Could not load your profile."));
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setSuccess("");
    setLoading(true);
    try {
      await api.put("/api/auth/me", form);
      setSuccess("Profile updated successfully.");
      sessionStorage.removeItem("dn_profile_unlock");
      setTimeout(() => navigate("/dashboard"), 1200);
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not update profile.");
    } finally {
      setLoading(false);
    }
  }

  if (!form) {
    return (
      <div className="page-shell">
        <HeaderTeal />
        <div className="page-body reg-body">{error || "Loading\u2026"}</div>
        <Footer copyright="Copyright \u00A9 (2026) National Informatics Centre, Pune" />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <HeaderTeal />
      <div className="page-body reg-body">
        <Link to="/dashboard" className="reg-back">&larr; Back</Link>
        <div className="reg-panel">
          <h1 className="reg-title">Update Profile</h1>

          {error && <div className="banner banner-error">{error}</div>}
          {success && <div className="banner banner-success">{success}</div>}

          <form onSubmit={handleSubmit}>
            <div className="reg-section-title">Contact Information &ndash;</div>
            <div className="reg-hint">[Fields marked with (*) are Mandatory.]</div>

            <div className="reg-row">
              <label>* Name :</label>
              <select value={form.title} onChange={(e) => update("title", e.target.value)}>
                <option>Mr.</option><option>Ms.</option><option>Mrs.</option>
              </select>
              <input placeholder="First Name" value={form.first_name} onChange={(e) => update("first_name", e.target.value)} required />
              <input placeholder="Last Name" value={form.last_name} onChange={(e) => update("last_name", e.target.value)} />
            </div>

            <div className="reg-divider" />

            <div className="reg-row-2">
              <label>* Mobile Number :</label>
              <input value={form.mobile_number} onChange={(e) => update("mobile_number", e.target.value)} required />
              <input placeholder="Land Line Number" value={form.landline_number} onChange={(e) => update("landline_number", e.target.value)} />
            </div>
            <div className="reg-row-2">
              <label>* Email ID :</label>
              <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required />
              <input placeholder="Alternate Email ID" value={form.alternate_email} onChange={(e) => update("alternate_email", e.target.value)} />
            </div>
            <div className="reg-row-2">
              <label>PAN Number :</label>
              <input value={form.pan_number} onChange={(e) => update("pan_number", e.target.value)} />
              <span />
            </div>
            <div className="reg-row-2">
              <label>* PIN Code :</label>
              <input value={form.pin_code} onChange={(e) => update("pin_code", e.target.value)} required />
              <span />
            </div>

            <div className="reg-row-2">
              <label></label>
              <select value={form.state} onChange={(e) => update("state", e.target.value)}>
                <option value="">--Select State--</option>
                <option>Maharashtra</option>
              </select>
              <select value={form.city} onChange={(e) => update("city", e.target.value)}>
                <option value="">--Select City--</option>
                <option>Pune</option>
              </select>
            </div>

            <div className="reg-section-title" style={{ marginTop: 20 }}>* Address Details :</div>
            <div className="reg-addr-row">
              <span />
              <input placeholder="Home No./Flat No." value={form.house_no} onChange={(e) => update("house_no", e.target.value)} />
              <input placeholder="Building Name or Number/Society" value={form.building_name} onChange={(e) => update("building_name", e.target.value)} />
            </div>
            <div className="reg-addr-row">
              <span />
              <input placeholder="Road/Street" value={form.road_street} onChange={(e) => update("road_street", e.target.value)} />
              <input placeholder="Area/Locality" value={form.area_locality} onChange={(e) => update("area_locality", e.target.value)} />
            </div>

            <div className="reg-actions">
              <button className="btn btn-green" type="submit" disabled={loading}>
                {loading ? "Saving\u2026" : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>
      <Footer copyright="Copyright \u00A9 (2026) National Informatics Centre, Pune" />
    </div>
  );
}
