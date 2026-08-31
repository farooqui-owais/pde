import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation(["auth", "common"]);
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
      setError(t("auth:invalidCaptcha"));
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/login", { username: form.username, password: form.password });
      localStorage.setItem("dn_token", data.access_token);
      localStorage.setItem("dn_user", JSON.stringify(data.user));
      navigate("/dashboard");
    } catch (err) {
      setError(err?.response?.data?.detail || t("auth:loginFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell">
      <HeaderTeal />
      <div className="page-body login-body">
        <div className="login-topline">
          <Link to="/dashboard" className="login-back">&larr; {t("common:back")}</Link>
        </div>
        <div className="login-notice">
          {t("auth:draftUploadNotice")}
          <a href="#">{t("auth:clickHere")}</a>
        </div>

        <div className="login-grid">
          <div className="login-panel">
            <h2>{t("auth:userLogin")}</h2>

            {error && <div className="banner banner-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="login-form-row">
                <label>{t("auth:username")}</label>
                <input value={form.username} onChange={(e) => update("username", e.target.value)} required autoFocus />
              </div>
              <div className="login-form-row">
                <label>{t("auth:password")}</label>
                <input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} required />
              </div>
              <div className="login-form-row">
                <span className="captcha-box">{captcha}</span>
                <input placeholder={t("auth:captcha")} value={form.captcha} onChange={(e) => update("captcha", e.target.value)} required autoComplete="off" />
                <button type="button" className="captcha-refresh" title="Refresh CAPTCHA" onClick={refreshCaptcha}>&#8635;</button>
              </div>
              <div className="login-remember">
                <input type="checkbox" id="remember" /> <label htmlFor="remember">{t("auth:rememberMe")}</label>
              </div>

              <div className="login-actions">
                <button className="btn btn-green" type="submit" disabled={loading}>
                  {loading ? t("auth:loggingIn") : t("auth:login")}
                </button>
                <button type="button" className="btn btn-red" onClick={() => setForm({ username: "", password: "", captcha: "" })}>
                  {t("auth:reset")}
                </button>
              </div>

              <div className="login-links">
                <Link to="/forgot-password">{t("auth:forgotPassword")}</Link>
                <Link to="/forgot-username">{t("auth:forgotUsername")}</Link>
              </div>
            </form>

            <div className="login-create">
              <button type="button" className="btn btn-blue" onClick={() => navigate("/register")}>
                {t("auth:createAccount")}
              </button>
            </div>
          </div>

          <div className="login-panel">
            <div className="draft-upload">
              <div className="line1">{t("auth:knowAboutDraftUpload")}</div>
              <div className="line2">{t("auth:clickHere")}</div>
            </div>
            <div className="login-panel-hint">{t("auth:afterLoginFacility")}</div>
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
