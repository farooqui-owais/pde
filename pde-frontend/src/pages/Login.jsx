import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axios.js";
import HeaderTeal from "../components/HeaderTeal.jsx";
import Footer from "../components/Footer.jsx";
import "./Login.css";

const MODULES = [
  { label: "Marriage Registration", color: "var(--blue)" },
  { label: "eRegistration", color: "var(--orange)" },
  { label: "eFiling", color: "var(--blue)" },
  { label: "\u0967/\u0967\u0968 Mutations", color: "var(--red)" },
  { label: "eProperty Card", color: "var(--blue)" },
  { label: "eMojni", color: "var(--blue)" },
];

/** CAPTCHA shown on the login form. Regenerated via the refresh button.
 *  Only unambiguous characters are used (no 0/O, 1/l/I) for readability. */
const CAPTCHA_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const CAPTCHA_LEN = 6;

function generateCaptcha() {
  let out = "";
  for (let i = 0; i < CAPTCHA_LEN; i++) {
    out += CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)];
  }
  return out;
}

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "", captcha: "" });
  const [captcha, setCaptcha] = useState(generateCaptcha);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function refreshCaptcha() {
    setCaptcha(generateCaptcha());
    setForm((f) => ({ ...f, captcha: "" }));
    setError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Validate the CAPTCHA client-side (case-insensitive).
    if (form.captcha.trim().toLowerCase() !== captcha.toLowerCase()) {
      setError("Invalid CAPTCHA. Please match the text shown.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/login", { username: form.username, password: form.password });
      localStorage.setItem("dn_token", data.access_token);
      localStorage.setItem("dn_user", JSON.stringify(data.user));
      navigate("/dashboard");
    } catch (err) {
      setError(err?.response?.data?.detail || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell">
      <HeaderTeal />
      <div className="page-body login-body">
        <div className="login-topline">
          <Link to="/dashboard" className="login-back">&larr; Back</Link>
        </div>
        <div className="login-notice">
          Do you want to avail the Online submission of Digital document facility? For more Details{" "}
          <a href="#">Click here</a>
        </div>

        <div className="login-grid">
          <div className="login-panel">
            <h2>User Login</h2>

            {error && <div className="banner banner-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="login-form-row">
                <label>User Name :</label>
                <input value={form.username} onChange={(e) => update("username", e.target.value)} required autoFocus />
              </div>
              <div className="login-form-row">
                <label>Password :</label>
                <input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} required />
              </div>
              <div className="login-form-row">
                <span className="captcha-box">{captcha}</span>
                <input placeholder="Enter CAPTCHA" value={form.captcha} onChange={(e) => update("captcha", e.target.value)} required autoComplete="off" />
                <button type="button" className="captcha-refresh" title="Refresh CAPTCHA" onClick={refreshCaptcha}>&#8635;</button>
              </div>
              <div className="login-remember">
                <input type="checkbox" id="remember" /> <label htmlFor="remember">Remember me</label>
              </div>

              <div className="login-actions">
                <button className="btn btn-green" type="submit" disabled={loading}>
                  {loading ? "Logging in\u2026" : "Login"}
                </button>
                <button type="button" className="btn btn-red" onClick={() => setForm({ username: "", password: "", captcha: "" })}>
                  Reset
                </button>
              </div>

              <div className="login-links">
                <Link to="/forgot-password">Forgot Password?</Link>
                <Link to="/forgot-username">Forgot UserName?</Link>
              </div>
            </form>

            <div className="login-create">
              <button type="button" className="btn btn-blue" onClick={() => navigate("/register")}>
                Create new user account
              </button>
            </div>
          </div>

          <div className="login-panel">
            <div className="draft-upload">
              <div className="line1">KNOW ABOUT DRAFT UPLOAD</div>
              <div className="line2">Click Here</div>
            </div>
            <div className="login-panel-hint">Below facility is available after login</div>
            <div className="module-list">
              {MODULES.map((m) => (
                <div key={m.label} className="module-pill" style={{ borderColor: m.color, color: m.color }}>
                  {m.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
