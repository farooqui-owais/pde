import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios.js";
import HeaderSarita from "../components/HeaderSarita.jsx";
import Footer from "../components/Footer.jsx";
import { formatApiValidationError } from "../utils/validation.js";
import "./EntrySteps.css";

export default function DataEntryReport() {
  const { t } = useTranslation(["pages", "common", "validation"]);
  const { id } = useParams();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    api.get(`/api/documents/${id}/report`)
      .then((r) => setReport(r.data))
      .catch((err) => setError(err?.response?.data?.detail || t("report.couldNotLoad")));
  }, [id]);

  async function handleNext() {
    setCompleting(true);
    setError("");
    try {
      await api.post(`/api/documents/${id}/complete`);
      navigate(`/entries/${id}/confirmation`);
    } catch (err) {
      setError(formatApiValidationError(err?.response?.data?.detail, t) || t("report.couldNotComplete"));
    } finally {
      setCompleting(false);
    }
  }

  if (error && !report) {
    return (
      <div className="page-shell">
        <HeaderSarita />
        <div className="page-body entry-body"><div className="banner banner-error">{error}</div></div>
      </div>
    );
  }
  if (!report) {
    return (
      <div className="page-shell">
        <HeaderSarita />
        <div className="page-body entry-body">{t("report.loading")}</div>
      </div>
    );
  }

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");
  const fmtParty = (p) => `${p.name || "—"}${p.age ? `${t("report.printfAge")} ${p.age}` : ""}${p.address ? `, ${p.address}` : ""}`;

  return (
    <div className="page-shell">
      <HeaderSarita />
      <div className="page-body entry-body">
        <h1 className="entry-title">{t("report.title")}</h1>
        {error && <div className="banner banner-error">{error}</div>}

        <div className="report-sheet">
          <div className="report-sheet-head">
            <div className="report-title-mr">{t("report.title")}<br /><small>{t("report.subtitle")}</small></div>
            <div className="report-meta">{t("report.token")} {report.token_number}<br />{t("report.date")} {fmtDate(new Date())}</div>
          </div>

          <div className="report-row"><span>(1)</span><b>{t("report.docType")}</b><span>{report.document_type || "—"}</span></div>
          <div className="report-row"><span>(2)</span><b>{t("report.consideration")}</b><span>Rs. {report.consideration_amount ?? "—"}</span></div>
          <div className="report-row"><span>(3)</span><b>{t("report.marketValue")}</b><span>Rs. {report.market_value ?? "—"}</span></div>
          <div className="report-row"><span>(4)</span><b>{t("report.requiredStampDuty")}</b><span>Rs. {report.required_stamp_duty ?? "—"}</span></div>
          <div className="report-row"><span>(5)</span><b>{t("report.dateOfExecution")}</b><span>{fmtDate(report.date_of_execution)}</span></div>
          <div className="report-row"><span>(6)</span><b>{t("report.villageName")}</b><span>{report.village_name || "—"}</span></div>
          <div className="report-row"><span>(7)</span><b>{t("report.noOfPages")}</b><span>{report.number_of_pages ?? "—"}</span></div>
          <div className="report-row"><span>(8)</span><b>{t("report.surveyNo")}</b><span>{report.survey_cts_numbers?.join(", ") || "—"}</span></div>
          <div className="report-row"><span>(9)</span><b>{t("report.tenureType")}</b><span>{report.tenure_and_area || "—"}</span></div>
          <div className="report-row"><span>(10)</span><b>{t("report.area")}</b><span>{report.area ?? "—"}</span></div>
          <div className="report-row">
            <span>(11)</span><b>{t("report.executants")}</b>
            <span>{report.executants?.length ? report.executants.map((p, i) => <div key={i}>{i + 1}) {fmtParty(p)}</div>) : "—"}</span>
          </div>
          <div className="report-row">
            <span>(12)</span><b>{t("report.claimants")}</b>
            <span>{report.claimants?.length ? report.claimants.map((p, i) => <div key={i}>{i + 1}) {fmtParty(p)}</div>) : "—"}</span>
          </div>
          <div className="report-row">
            <span>(13)</span><b>{t("report.witnesses")}</b>
            <span>{report.witnesses?.length ? report.witnesses.map((p, i) => <div key={i}>{i + 1}) {fmtParty(p)}</div>) : "—"}</span>
          </div>

          <div className="report-note">
            {t("report.note")}
          </div>
        </div>

        <div className="entry-actions">
          <button type="button" className="btn btn-blue" onClick={() => navigate(`/entries/${id}/identifications`)}>{t("common:previous")}</button>
          <button type="button" className="btn btn-outline" onClick={() => window.print()}>{t("common:print")}</button>
          <button type="button" className="btn btn-green" onClick={handleNext} disabled={completing}>
            {completing ? t("report.submitting") : t("common:next")}
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
