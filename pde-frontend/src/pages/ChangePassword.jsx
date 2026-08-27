import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios.js";
import HeaderTeal from "../components/HeaderTeal.jsx";
import Footer from "../components/Footer.jsx";
import "./ChangePassword.css";

const CAPTCHA_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const CAPTCHA_LEN = 6;

function generateCaptcha() {
  let out = "";
  for (let i = 0; i < CAPTCHA_LEN; i++) {
    out += CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)];
  }
  return out;
}

const EMPTY = { old_password: "", new_password: "", confirm_password: "", captcha: "" };

export default function ChangePassword() {
  const navigate = useNavigate();
  const userRaw = localStorage.getItem("dn_user");
  const user = userRaw ? JSON.parse(userRaw) : null;

  const [form, setForm] = useState(EMPTY);
  const [captcha, setCaptcha] = useState(generateCaptcha);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function refreshCaptcha() {
    setCaptcha(generateCaptcha());
    setForm((f) => ({ ...f, captcha: "" }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (form.captcha.trim().toLowerCase() !== captcha.toLowerCase()) {
      setError("Invalid CAPTCHA. Please match the text shown.");
      return;
    }
    if (form.new_password !== form.confirm_password) {
      setError("New password and confirm password do not match.");
      return;
    }
    if (form.new_password.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/auth/change-password", {
        old_password: form.old_password,
        new_password: form.new_password,
      });
      setSuccess("Password changed successfully.");
      setForm(EMPTY);
      refreshCaptcha();
      setTimeout(() => navigate("/dashboard"), 1200);
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not change password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell">
      <HeaderTeal />
      <div className="page-body cpw-body">
        <div className="cpw-panel">
          <Link to="/dashboard" className="cpw-back">&larr; Back</Link>
          <h2 className="cpw-title">Change Password</h2>
          <div className="cpw-divider" />

          <div className="cpw-username-row">User Name : <strong>{user?.username || ""}</strong></div>
          <div className="cpw-divider" />

          {error && <div className="banner banner-error">{error}</div>}
          {success && <div className="banner banner-success">{success}</div>}

          <form onSubmit={handleSubmit}>
            <div className="cpw-form-row">
              <label>Old Password :</label>
              <input type="password" value={form.old_password} onChange={(e) => update("old_password", e.target.value)} required autoFocus />
            </div>
            <div className="cpw-form-row">
              <label>New Password :</label>
              <input type="password" value={form.new_password} onChange={(e) => update("new_password", e.target.value)} required />
            </div>
            <div className="cpw-form-row">
              <label>Confirm Password :</label>
              <input type="password" value={form.confirm_password} onChange={(e) => update("confirm_password", e.target.value)} required />
            </div>
            <div className="cpw-form-row">
              <span className="captcha-box">{captcha}</span>
              <input placeholder="Enter CAPTCHA" value={form.captcha} onChange={(e) => update("captcha", e.target.value)} required autoComplete="off" />
              <button type="button" className="captcha-refresh" title="Refresh CAPTCHA" onClick={refreshCaptcha}>&#8635;</button>
            </div>

            <div className="cpw-divider" />
            <div className="cpw-actions">
              <button className="btn btn-green" type="submit" disabled={loading}>
                {loading ? "Changing\u2026" : "Change"}
              </button>
              <button type="button" className="btn btn-red" onClick={() => { setForm(EMPTY); setError(""); setSuccess(""); }}>
                Reset
              </button>
            </div>
            <div className="cpw-divider" />
          </form>
        </div>
      </div>
      <Footer copyright="Copyright \u00A9 (2026) National Informatics Centre, Pune" />
    </div>
  );
}
