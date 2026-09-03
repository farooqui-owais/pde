import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios.js";
import HeaderTeal from "../components/HeaderTeal.jsx";
import Footer from "../components/Footer.jsx";
import {
  formatApiValidationError,
  validateForgotUsernameForm,
  validateOtp,
} from "../utils/validation.js";
import "./ForgotUserName.css";

const CAPTCHA_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const CAPTCHA_LEN = 6;

function generateCaptcha() {
  let out = "";
  for (let i = 0; i < CAPTCHA_LEN; i++) {
    out += CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)];
  }
  return out;
}

export default function ForgotUserName() {
  const { t } = useTranslation(["validation"]);
  // step 1: mobile + security question -> send OTP
  const [form, setForm] = useState({ mobile_number: "", security_question: "", security_answer: "", captcha: "" });
  const [captcha, setCaptcha] = useState(generateCaptcha);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // step 2: enter OTP
  const [otpToken, setOtpToken] = useState(null);
  const [devOtpNote, setDevOtpNote] = useState("");
  const [otp, setOtp] = useState("");

  // step 3: result
  const [foundUsername, setFoundUsername] = useState("");

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function refreshCaptcha() {
    setCaptcha(generateCaptcha());
    setForm((f) => ({ ...f, captcha: "" }));
  }

  async function handleSendOtp(e) {
    e.preventDefault();
    setError("");

    if (form.captcha.trim().toLowerCase() !== captcha.toLowerCase()) {
      setError("Invalid CAPTCHA. Please match the text shown.");
      return;
    }
    const validationError = validateForgotUsernameForm(form);
    if (validationError) { setError(t(validationError)); return; }

    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/forgot-username/send-otp", {
        mobile_number: form.mobile_number,
        security_question: form.security_question,
        security_answer: form.security_answer,
      });
      setOtpToken(data.otp_token);
      // This clone has no SMS gateway wired up — the backend returns the OTP
      // directly (see ForgotUsernameSendOtpResponse.note) so the flow stays
      // testable end-to-end. A real deployment would text it instead.
      setDevOtpNote(data.dev_otp ? `Demo mode — OTP: ${data.dev_otp}` : "");
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not send OTP.");
      refreshCaptcha();
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError("");
    const validationError = validateOtp(otp);
    if (validationError) { setError(t(validationError)); return; }

    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/forgot-username/verify-otp", {
        otp_token: otpToken,
        otp,
      });
      setFoundUsername(data.username);
    } catch (err) {
      setError(err?.response?.data?.detail || "Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell">
      <HeaderTeal />
      <div className="page-body fun-body">
        <div className="fun-panel">
          <Link to="/login" className="fun-back">&larr; Back</Link>
          <h2 className="fun-title">Forgot UserName</h2>
          <div className="fun-divider" />

          {error && <div className="banner banner-error">{error}</div>}

          {foundUsername ? (
            <div className="banner banner-success" style={{ textAlign: "center" }}>
              Your username is: <strong>{foundUsername}</strong>
            </div>
          ) : !otpToken ? (
            <form onSubmit={handleSendOtp}>
              <div className="fun-form-row">
                <label>Registered Mobile Number:</label>
                <input value={form.mobile_number} onChange={(e) => update("mobile_number", e.target.value)} required autoFocus />
              </div>
              <div className="fun-form-row">
                <label>Security Question :</label>
                <select value={form.security_question} onChange={(e) => update("security_question", e.target.value)} required>
                  <option value="">Select Security Question</option>
                  <option>What is your birth city?</option>
                  <option>What was your first school?</option>
                </select>
              </div>
              <div className="fun-form-row">
                <label>Answer :</label>
                <input value={form.security_answer} onChange={(e) => update("security_answer", e.target.value)} required />
              </div>
              <div className="fun-form-row">
                <span className="captcha-box">{captcha}</span>
                <input placeholder="Enter CAPTCHA" value={form.captcha} onChange={(e) => update("captcha", e.target.value)} required autoComplete="off" />
                <button type="button" className="captcha-refresh" title="Refresh CAPTCHA" onClick={refreshCaptcha}>&#8635;</button>
              </div>

              <div className="fun-divider" />
              <div className="fun-actions">
                <button className="btn btn-green" type="submit" disabled={loading}>
                  {loading ? "Sending\u2026" : "Send OTP"}
                </button>
                <button type="button" className="btn btn-red" onClick={() => { setForm({ mobile_number: "", security_question: "", security_answer: "", captcha: "" }); setError(""); }}>
                  Reset
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp}>
              {devOtpNote && <div className="fun-hint">{devOtpNote}</div>}
              <div className="fun-form-row">
                <label>Enter OTP :</label>
                <input value={otp} onChange={(e) => setOtp(e.target.value)} required autoFocus />
              </div>
              <div className="fun-divider" />
              <div className="fun-actions">
                <button className="btn btn-green" type="submit" disabled={loading}>
                  {loading ? "Verifying\u2026" : "Verify OTP"}
                </button>
              </div>
            </form>
          )}
          <div className="fun-divider" />
        </div>
      </div>
      <Footer copyright="Copyright \u00A9 (2026) National Informatics Centre, Pune" />
    </div>
  );
}
