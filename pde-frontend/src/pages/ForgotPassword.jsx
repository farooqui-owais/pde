import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios.js";
import HeaderTeal from "../components/HeaderTeal.jsx";
import Footer from "../components/Footer.jsx";
import {
  formatApiValidationError,
  validateForgotPasswordResetForm,
  validateForgotPasswordVerifyForm,
} from "../utils/validation.js";
import "./ForgotPassword.css";

const CAPTCHA_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const CAPTCHA_LEN = 6;

function generateCaptcha() {
  let out = "";
  for (let i = 0; i < CAPTCHA_LEN; i++) {
    out += CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)];
  }
  return out;
}

export default function ForgotPassword() {
  const { t } = useTranslation(["validation"]);
  const navigate = useNavigate();

  // step 1: identity / security-question verification
  const [form, setForm] = useState({ username: "", security_question: "", security_answer: "", captcha: "" });
  const [captcha, setCaptcha] = useState(generateCaptcha);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // step 2: set new password (revealed after verification succeeds)
  const [resetToken, setResetToken] = useState(null);
  const [pwForm, setPwForm] = useState({ new_password: "", confirm_password: "" });
  const [success, setSuccess] = useState("");

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function refreshCaptcha() {
    setCaptcha(generateCaptcha());
    setForm((f) => ({ ...f, captcha: "" }));
  }

  async function handleVerify(e) {
    e.preventDefault();
    setError("");

    if (form.captcha.trim().toLowerCase() !== captcha.toLowerCase()) {
      setError("Invalid CAPTCHA. Please match the text shown.");
      return;
    }
    const validationError = validateForgotPasswordVerifyForm(form);
    if (validationError) { setError(t(validationError)); return; }

    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/forgot-password/verify", {
        username: form.username,
        security_question: form.security_question,
        security_answer: form.security_answer,
      });
      setResetToken(data.reset_token);
    } catch (err) {
      setError(formatApiValidationError(err?.response?.data?.detail, t) || "Could not verify your details.");
      refreshCaptcha();
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    setError("");
    const validationError = validateForgotPasswordResetForm(pwForm);
    if (validationError) { setError(t(validationError)); return; }

    setLoading(true);
    try {
      await api.post("/api/auth/forgot-password/reset", {
        reset_token: resetToken,
        new_password: pwForm.new_password,
      });
      setSuccess("Password reset successfully. You can now log in.");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell">
      <HeaderTeal />
      <div className="page-body fpw-body">
        <div className="fpw-panel">
          <Link to="/login" className="fpw-back">&larr; Back</Link>
          <h2 className="fpw-title">Forgot Password</h2>
          <div className="fpw-divider" />

          {error && <div className="banner banner-error">{error}</div>}
          {success && <div className="banner banner-success">{success}</div>}

          {!resetToken ? (
            <form onSubmit={handleVerify}>
              <div className="fpw-form-row">
                <label>Username :</label>
                <input value={form.username} onChange={(e) => update("username", e.target.value)} required autoFocus />
              </div>
              <div className="fpw-form-row">
                <label>Security Question :</label>
                <select value={form.security_question} onChange={(e) => update("security_question", e.target.value)} required>
                  <option value="">Select Security Question</option>
                  <option>What is your birth city?</option>
                  <option>What was your first school?</option>
                </select>
              </div>
              <div className="fpw-form-row">
                <label>Answer :</label>
                <input value={form.security_answer} onChange={(e) => update("security_answer", e.target.value)} required />
              </div>
              <div className="fpw-form-row">
                <span className="captcha-box">{captcha}</span>
                <input placeholder="Enter CAPTCHA" value={form.captcha} onChange={(e) => update("captcha", e.target.value)} required autoComplete="off" />
                <button type="button" className="captcha-refresh" title="Refresh CAPTCHA" onClick={refreshCaptcha}>&#8635;</button>
              </div>

              <div className="fpw-divider" />
              <div className="fpw-actions">
                <button className="btn btn-green" type="submit" disabled={loading}>
                  {loading ? "Checking\u2026" : "Reset Password"}
                </button>
                <button type="button" className="btn btn-red" onClick={() => { setForm({ username: "", security_question: "", security_answer: "", captcha: "" }); setError(""); }}>
                  Reset
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleReset}>
              <div className="fpw-hint">Identity verified. Choose a new password below.</div>
              <div className="fpw-form-row">
                <label>New Password :</label>
                <input type="password" value={pwForm.new_password} onChange={(e) => setPwForm((f) => ({ ...f, new_password: e.target.value }))} required autoFocus />
              </div>
              <div className="fpw-form-row">
                <label>Confirm Password :</label>
                <input type="password" value={pwForm.confirm_password} onChange={(e) => setPwForm((f) => ({ ...f, confirm_password: e.target.value }))} required />
              </div>
              <div className="fpw-divider" />
              <div className="fpw-actions">
                <button className="btn btn-green" type="submit" disabled={loading}>
                  {loading ? "Saving\u2026" : "Set New Password"}
                </button>
              </div>
            </form>
          )}
          <div className="fpw-divider" />
        </div>
      </div>
      <Footer copyright="Copyright \u00A9 (2026) National Informatics Centre, Pune" />
    </div>
  );
}
