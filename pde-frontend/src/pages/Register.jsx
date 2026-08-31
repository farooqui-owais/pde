import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation(["auth", "common"]);
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
    if (form.password !== form.confirm_password) { setError(t("auth:passwordMismatchReg")); return; }
    if (form.password.length < 8) { setError(t("auth:passwordTooShortReg")); return; }

    setLoading(true);
    try {
      const { confirm_password, ...payload } = form;
      await api.post("/api/auth/register", payload);
      setSuccess(t("auth:accountCreated"));
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(err?.response?.data?.detail || t("auth:registrationFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell">
      <HeaderTeal />
      <div className="page-body reg-body">
        <Link to="/login" className="reg-back">&larr; {t("common:back")}</Link>
        <div className="reg-panel">
          <h1 className="reg-title">{t("auth:newUsersSignUp")}</h1>

          {error && <div className="banner banner-error">{error}</div>}
          {success && <div className="banner banner-success">{success}</div>}

          <form onSubmit={handleSubmit}>
            <div className="reg-section-title">{t("auth:contactInformation")}</div>
            <div className="reg-hint">{t("auth:mandatoryFields")}</div>

            <div className="reg-row">
              <label>{t("auth:name")}</label>
              <select value={form.title} onChange={(e) => update("title", e.target.value)}>
                <option>Mr.</option><option>Ms.</option><option>Mrs.</option>
              </select>
              <input placeholder={t("auth:firstNamePlaceholder")} value={form.first_name} onChange={(e) => update("first_name", e.target.value)} required />
              <input placeholder={t("auth:lastNamePlaceholder")} value={form.last_name} onChange={(e) => update("last_name", e.target.value)} />
            </div>

            <div className="reg-divider" />
            <div className="reg-section-title">{t("auth:loginDetails")}</div>

            <div className="reg-row-2">
              <label>{t("auth:userNameColon")}</label>
              <input value={form.username} onChange={(e) => update("username", e.target.value)} onBlur={checkUsername} required />
              <button type="button" className="btn btn-blue" onClick={checkUsername}>{t("auth:checkAvailability")}</button>
            </div>
            {usernameStatus === true && <div className="reg-hint" style={{ color: "var(--green)" }}>{t("auth:available")}</div>}
            {usernameStatus === false && <div className="reg-hint" style={{ color: "var(--red)" }}>{t("auth:alreadyTaken")}</div>}

            <div className="reg-row-2">
              <label>{t("auth:passwordColon")}</label>
              <input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} required />
              <input type="password" placeholder={t("auth:reEnterPassword")} value={form.confirm_password} onChange={(e) => update("confirm_password", e.target.value)} required />
            </div>

            <div className="reg-row-2">
              <label>{t("auth:securityQuestion")}</label>
              <select value={form.security_question} onChange={(e) => update("security_question", e.target.value)}>
                <option value="">{t("auth:selectSecurityQuestion")}</option>
                <option>{t("auth:birthCityQuestion")}</option>
                <option>{t("auth:firstSchoolQuestion")}</option>
              </select>
              <input placeholder={t("auth:securityAnswerPlaceholder")} value={form.security_answer} onChange={(e) => update("security_answer", e.target.value)} />
            </div>

            <div className="reg-note">
              {t("auth:regNote")}
            </div>

            <div className="reg-row-2">
              <label>{t("auth:mobileNumberColon")}</label>
              <input value={form.mobile_number} onChange={(e) => update("mobile_number", e.target.value)} required />
              <input placeholder={t("auth:landlinePlaceholder")} value={form.landline_number} onChange={(e) => update("landline_number", e.target.value)} />
            </div>
            <div className="reg-row-2">
              <label>{t("auth:emailIdColon")}</label>
              <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required />
              <input placeholder={t("auth:alternateEmailPlaceholder")} value={form.alternate_email} onChange={(e) => update("alternate_email", e.target.value)} />
            </div>
            <div className="reg-row-2">
              <label>{t("auth:panNumberColon")}</label>
              <input value={form.pan_number} onChange={(e) => update("pan_number", e.target.value)} />
              <span />
            </div>
            <div className="reg-row-2">
              <label>{t("auth:pinCodeColon")}</label>
              <input value={form.pin_code} onChange={(e) => update("pin_code", e.target.value)} required />
              <span />
            </div>

            <div className="reg-row-2">
              <label></label>
              <select value={form.state} onChange={(e) => update("state", e.target.value)}>
                <option value="">{t("auth:selectState")}</option>
                <option>Maharashtra</option>
              </select>
              <select value={form.city} onChange={(e) => update("city", e.target.value)}>
                <option value="">{t("auth:selectCity")}</option>
                <option>Pune</option>
              </select>
            </div>

            <div className="reg-section-title" style={{ marginTop: 20 }}>{t("auth:addressDetails")}</div>
            <div className="reg-addr-row">
              <span />
              <input placeholder={t("auth:homeNoPlaceholder")} value={form.house_no} onChange={(e) => update("house_no", e.target.value)} />
              <input placeholder={t("auth:buildingPlaceholder")} value={form.building_name} onChange={(e) => update("building_name", e.target.value)} />
            </div>
            <div className="reg-addr-row">
              <span />
              <input placeholder={t("auth:roadPlaceholder")} value={form.road_street} onChange={(e) => update("road_street", e.target.value)} />
              <input placeholder={t("auth:areaPlaceholder")} value={form.area_locality} onChange={(e) => update("area_locality", e.target.value)} />
            </div>

            <div className="reg-actions">
              <button className="btn btn-green" type="submit" disabled={loading}>
                {loading ? t("common:saving") : t("common:save")}
              </button>
              <button type="button" className="btn btn-red" onClick={() => setForm(EMPTY)}>{t("auth:reset")}</button>
            </div>
          </form>
        </div>
      </div>
      <Footer copyright="Copyright \u00A9 (2026) National Informatics Centre, Pune" />
    </div>
  );
}
