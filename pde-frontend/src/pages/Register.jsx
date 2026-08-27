import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios.js";
import HeaderTeal from "../components/HeaderTeal.jsx";
import Footer from "../components/Footer.jsx";
import "./Register.css";

const EMPTY = {
  title: "Mr.", first_name: "", middle_name: "", last_name: "",
  username: "", password: "", confirm_password: "",
  mobile_number: "", landline_number: "", email: "", alternate_email: "", pan_number: "",
  pin_code: "", state: "", district_name: "", city: "",
  house_no: "", building_name: "", road_street: "", area_locality: "",
  security_question: "", security_answer: "",
};

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function checkUsername() {
    if (!form.username) return;
    try {
      const { data } = await api.get("/api/auth/check-username", { params: { username: form.username } });
      setUsernameStatus(data.available);
    } catch {
      setUsernameStatus(null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (form.password !== form.confirm_password) { setError("Password and confirm password do not match."); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }

    setLoading(true);
    try {
      const { confirm_password, ...payload } = form;
      await api.post("/api/auth/register", payload);
      setSuccess("Account created. You can now log in.");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(err?.response?.data?.detail || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell">
      <HeaderTeal />
      <div className="page-body reg-body">
        <Link to="/login" className="reg-back">&larr; Back</Link>
        <div className="reg-panel">
          <h1 className="reg-title">New Users Sign Up</h1>

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
            <div className="reg-section-title">Login Details</div>

            <div className="reg-row-2">
              <label>* User Name :</label>
              <input value={form.username} onChange={(e) => update("username", e.target.value)} onBlur={checkUsername} required />
              <button type="button" className="btn btn-blue" onClick={checkUsername}>Check availability</button>
            </div>
            {usernameStatus === true && <div className="reg-hint" style={{ color: "var(--green)" }}>Available</div>}
            {usernameStatus === false && <div className="reg-hint" style={{ color: "var(--red)" }}>Already taken</div>}

            <div className="reg-row-2">
              <label>* Password :</label>
              <input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} required />
              <input type="password" placeholder="Re enter Password" value={form.confirm_password} onChange={(e) => update("confirm_password", e.target.value)} required />
            </div>

            <div className="reg-row-2">
              <label>* Security Question :</label>
              <select value={form.security_question} onChange={(e) => update("security_question", e.target.value)}>
                <option value="">Select Security Question</option>
                <option>What is your birth city?</option>
                <option>What was your first school?</option>
              </select>
              <input placeholder="Security Answer" value={form.security_answer} onChange={(e) => update("security_answer", e.target.value)} />
            </div>

            <div className="reg-note">
              Note : 1. Username contains alphanumeric characters, underscore and dot. 6-15 Characters
              Allowed. Username must Start with alphabet.<br />
              2. Password length must be minimum 8 characters. Password must contain atleast one
              (capital letter, small letter, special character and digit) e.g abcdA09@
            </div>

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
              <button type="button" className="btn btn-red" onClick={() => setForm(EMPTY)}>Reset</button>
            </div>
          </form>
        </div>
      </div>
      <Footer copyright="Copyright \u00A9 (2026) DakhalNama 1.9, National Informatics Centre, Pune" />
    </div>
  );
}
