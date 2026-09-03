import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import verificationApi from "../api/verificationApi.js";
import HeaderSarita from "../components/HeaderSarita.jsx";
import Footer from "../components/Footer.jsx";
import "./EntrySteps.css";

const BLANK = {
  state: "Maharashtra",
  district: "",
  taluka: "",
  village: "",
  rate_per_sqft: "",
  rate_per_sqm: "",
  rate_per_acre: "",
};

export default function ValuationRates() {
  const { t } = useTranslation(["pages", "common"]);
  const navigate = useNavigate();

  const [rates, setRates] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [filterDistrict, setFilterDistrict] = useState("");

  async function load(district = filterDistrict) {
    try {
      const { data } = await verificationApi.listValuationRates(district ? { district } : {});
      setRates(data);
    } catch (err) {
      setError(err?.response?.data?.detail || t("valuationRates.couldNotLoad"));
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleAdd() {
    setError("");
    if (!form.district || !form.village) {
      setError(t("valuationRates.needDistrictVillage"));
      return;
    }
    setSaving(true);
    try {
      await verificationApi.createValuationRate({
        ...form,
        rate_per_sqft: form.rate_per_sqft ? Number(form.rate_per_sqft) : null,
        rate_per_sqm: form.rate_per_sqm ? Number(form.rate_per_sqm) : null,
        rate_per_acre: form.rate_per_acre ? Number(form.rate_per_acre) : null,
      });
      setForm(BLANK);
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || t("valuationRates.couldNotSave"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(rateId) {
    if (!window.confirm(t("common:delete") + "?")) return;
    try {
      await verificationApi.deleteValuationRate(rateId);
      await load();
    } catch { /* ignore */ }
  }

  return (
    <div className="page-shell">
      <HeaderSarita />
      <div className="page-body entry-body">
        <h1 className="entry-title">{t("valuationRates.title")}</h1>
        <div className="banner banner-info">{t("valuationRates.tbdNotice")}</div>
        {error && <div className="banner banner-error">{error}</div>}

        <div className="entry-grid">
          <label>{t("valuationRates.district")}</label>
          <input value={form.district} onChange={(e) => update("district", e.target.value)} />
          <label>{t("valuationRates.taluka")}</label>
          <input value={form.taluka} onChange={(e) => update("taluka", e.target.value)} />

          <label>{t("valuationRates.village")}</label>
          <input value={form.village} onChange={(e) => update("village", e.target.value)} />
          <span />

          <label>{t("valuationRates.ratePerSqft")}</label>
          <input type="number" value={form.rate_per_sqft} onChange={(e) => update("rate_per_sqft", e.target.value)} />
          <label>{t("valuationRates.ratePerSqm")}</label>
          <input type="number" value={form.rate_per_sqm} onChange={(e) => update("rate_per_sqm", e.target.value)} />

          <label>{t("valuationRates.ratePerAcre")}</label>
          <input type="number" value={form.rate_per_acre} onChange={(e) => update("rate_per_acre", e.target.value)} />
          <span />
        </div>

        <div className="entry-actions">
          <button type="button" className="btn btn-blue" onClick={() => navigate("/dashboard")}>{t("common:back")}</button>
          <button type="button" className="btn btn-green" onClick={handleAdd} disabled={saving}>
            {saving ? t("common:saving") : t("common:add")}
          </button>
        </div>

        <div className="eks-row" style={{ marginTop: 24 }}>
          <label>{t("valuationRates.filterByDistrict")}</label>
          <input value={filterDistrict} onChange={(e) => setFilterDistrict(e.target.value)} />
          <button type="button" className="btn btn-outline" onClick={() => load(filterDistrict)}>{t("common:select")}</button>
        </div>

        <div className="step-table-title">{t("valuationRates.tableTitle")}</div>
        <table className="step-table">
          <thead>
            <tr>
              <th>{t("valuationRates.district")}</th>
              <th>{t("valuationRates.taluka")}</th>
              <th>{t("valuationRates.village")}</th>
              <th>{t("valuationRates.ratePerSqft")}</th>
              <th>{t("valuationRates.ratePerSqm")}</th>
              <th>{t("valuationRates.ratePerAcre")}</th>
              <th>{t("common:delete")}</th>
            </tr>
          </thead>
          <tbody>
            {rates.length === 0 && <tr><td colSpan={7} style={{ color: "#777" }}>{t("valuationRates.noRows")}</td></tr>}
            {rates.map((r) => (
              <tr key={r.id}>
                <td>{r.district || "—"}</td>
                <td>{r.taluka || "—"}</td>
                <td>{r.village || "—"}</td>
                <td>{r.rate_per_sqft ?? "—"}</td>
                <td>{r.rate_per_sqm ?? "—"}</td>
                <td>{r.rate_per_acre ?? "—"}</td>
                <td><a href="#" onClick={(e) => { e.preventDefault(); handleDelete(r.id); }}>{t("common:delete")}</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Footer />
    </div>
  );
}
