import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios.js";
import HeaderTeal from "../components/HeaderTeal.jsx";
import Footer from "../components/Footer.jsx";
import { formatApiValidationError, validateRegistrationForm } from "../utils/validation.js";
import "./Register.css";

const CAPTCHA_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const CAPTCHA_LEN = 6;

function generateCaptcha() {
  let out = "";
  for (let i = 0; i < CAPTCHA_LEN; i++) {
    out += CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)];
  }
  return out;
}

const EMPTY = {
  title: "Mr.", first_name: "", middle_name: "", last_name: "",
  username: "", password: "", confirm_password: "",
  mobile_number: "", landline_number: "", email: "", alternate_email: "", pan_number: "",
  pin_code: "", country: "India", state: "", district_name: "", city: "", area_locality: "",
  house_no: "", building_name: "", road_street: "",
  security_question: "", security_answer: "", captcha: "",
};

export default function Register() {
  const { t } = useTranslation(["auth", "common", "validation"]);
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState(null);

  // CAPTCHA (client-side, same mechanism as Login/Forgot pages)
  const [captcha, setCaptcha] = useState(generateCaptcha);

  // Pincode-driven auto-fill of Country / State / City / Area
  const [areaOptions, setAreaOptions] = useState([]);
  // Standalone selection for the PIN-code "Area/Locality" dropdown. Deliberately
  // kept OUT of `form` so it never touches the separate Address Details
  // "Area/Locality" input (`form.area_locality`).
  const [pinArea, setPinArea] = useState("");
  const [pinStatus, setPinStatus] = useState(""); // "", "loading", "ok", "notfound", "error"
  const lookupSeq = useRef(0);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function refreshCaptcha() {
    setCaptcha(generateCaptcha());
    setForm((f) => ({ ...f, captcha: "" }));
  }

  async function lookupPincode(pin) {
    const seq = ++lookupSeq.current;
    setPinStatus("loading");
    try {
      const { data } = await api.get("/api/auth/pincode-lookup", { params: { pin } });
      if (seq !== lookupSeq.current) return; // a newer lookup superseded this one
      if (!data.found) {
        setPinStatus("notfound");
        setAreaOptions([]);
        return;
      }
      setPinStatus("ok");
      setAreaOptions(data.areas || []);
      // No placeholder option: default the dropdown to the first area value.
      setPinArea((data.areas || [])[0] || "");
      setForm((f) => ({
        ...f,
        country: data.country || "India",
        state: data.state || "",
        district_name: data.district || "",
        city: data.city || "",
      }));
    } catch {
      if (seq !== lookupSeq.current) return;
      setPinStatus("error");
      setAreaOptions([]);
      setPinArea("");
    }
  }

  function handlePinChange(value) {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    update("pin_code", digits);
    if (digits.length === 6) {
      lookupPincode(digits);
    } else {
      lookupSeq.current++; // cancel any in-flight lookup
      setPinStatus("");
      setAreaOptions([]);
      setPinArea("");
    }
  }

  useEffect(() => {
    // Re-fill for an already-complete pin (e.g. after Reset)
    if (form.pin_code.length === 6 && !pinStatus) lookupPincode(form.pin_code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const validationError = validateRegistrationForm(form);
    if (validationError) { setError(t(validationError)); return; }

    // Validate the CAPTCHA client-side (case-insensitive), same as Login.
    if (form.captcha.trim().toLowerCase() !== captcha.toLowerCase()) {
      setError(t("auth:invalidCaptcha"));
      refreshCaptcha();
      return;
    }

    setLoading(true);
    try {
      const { confirm_password, captcha: _captcha, ...payload } = form;
      await api.post("/api/auth/register", payload);
      setSuccess(t("auth:accountCreated"));
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(formatApiValidationError(err?.response?.data?.detail, t) || t("auth:registrationFailed"));
      refreshCaptcha();
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
              <input placeholder={t("auth:middleNamePlaceholder")} value={form.middle_name} onChange={(e) => update("middle_name", e.target.value)} />
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
              <input
                value={form.pin_code}
                onChange={(e) => handlePinChange(e.target.value)}
                inputMode="numeric"
                maxLength={6}
                placeholder="411001"
                required
              />
              <span className="reg-pin-status">
                {pinStatus === "loading" && t("auth:pinLookupLoading")}
                {pinStatus === "notfound" && t("auth:pinLookupNotFound")}
                {pinStatus === "error" && t("auth:pinLookupError")}
              </span>
            </div>

            <div className="reg-row-pair">
              <label>{t("auth:countryColon")}</label>
              <select value={form.country} onChange={(e) => update("country", e.target.value)} disabled={pinStatus === "loading"}>
                <option value="">{t("auth:selectCountry")}</option>
                <option>India</option>
              </select>
              <label>{t("auth:stateColon")}</label>
              <select value={form.state} onChange={(e) => update("state", e.target.value)} disabled={pinStatus === "loading"}>
                <option value="">{t("auth:selectState")}</option>
                {form.state && <option>{form.state}</option>}
              </select>
            </div>

            <div className="reg-row-pair">
              <label>{t("auth:cityColon")}</label>
              <select value={form.city} onChange={(e) => update("city", e.target.value)} disabled={pinStatus === "loading"}>
                <option value="">{t("auth:selectCity")}</option>
                {form.city && <option>{form.city}</option>}
              </select>
              <label>{t("auth:areaColon")}</label>
              <select value={pinArea} onChange={(e) => setPinArea(e.target.value)}>
                {areaOptions.length > 0 ? (
                  areaOptions.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))
                ) : (
                  <option value="">{t("auth:selectArea")}</option>
                )}
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

            <div className="reg-row-2 reg-captcha-row">
              <label>{t("auth:captchaColon")}</label>
              <div className="reg-captcha-controls">
                <span className="captcha-box">{captcha}</span>
                <input
                  placeholder={t("auth:captcha")}
                  value={form.captcha}
                  onChange={(e) => update("captcha", e.target.value)}
                  required
                  autoComplete="off"
                />
                <button type="button" className="captcha-refresh" title="Refresh CAPTCHA" onClick={refreshCaptcha}>&#8635;</button>
              </div>
              <span />
            </div>

            <div className="reg-actions">
              <button className="btn btn-green" type="submit" disabled={loading}>
                {loading ? t("common:saving") : t("common:save")}
              </button>
              <button
                type="button"
                className="btn btn-red"
                onClick={() => { setForm(EMPTY); setPinStatus(""); setAreaOptions([]); setPinArea(""); refreshCaptcha(); }}
              >
                {t("auth:reset")}
              </button>
            </div>
          </form>
        </div>
      </div>
      <Footer copyright="Copyright \u00A9 (2026) National Informatics Centre, Pune" />
    </div>
  );
}
