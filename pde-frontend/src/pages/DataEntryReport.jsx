import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axios.js";
import HeaderSarita from "../components/HeaderSarita.jsx";
import Footer from "../components/Footer.jsx";
import "./EntrySteps.css";

export default function DataEntryReport() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    api.get(`/api/documents/${id}/report`)
      .then((r) => setReport(r.data))
      .catch((err) => setError(err?.response?.data?.detail || "Could not load the report."));
  }, [id]);

  async function handleNext() {
    setCompleting(true);
    setError("");
    try {
      await api.post(`/api/documents/${id}/complete`);
      navigate(`/entries/${id}/confirmation`);
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not complete this entry.");
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
        <div className="page-body entry-body">Loading report…</div>
      </div>
    );
  }

  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");
  const fmtParty = (p) => `${p.name || "—"}${p.age ? `, Age: ${p.age}` : ""}${p.address ? `, ${p.address}` : ""}`;

  return (
    <div className="page-shell">
      <HeaderSarita />
      <div className="page-body entry-body">
        <h1 className="entry-title">Public Data Entry Report</h1>
        {error && <div className="banner banner-error">{error}</div>}

        <div className="report-sheet">
          <div className="report-sheet-head">
            <div className="report-title-mr">Public Data Entry Report<br /><small>Information filled in for document registration</small></div>
            <div className="report-meta">Token: {report.token_number}<br />Date: {fmtDate(new Date())}</div>
          </div>

          <div className="report-row"><span>(1)</span><b>Document Type</b><span>{report.document_type || "—"}</span></div>
          <div className="report-row"><span>(2)</span><b>Consideration</b><span>Rs. {report.consideration_amount ?? "—"}</span></div>
          <div className="report-row"><span>(3)</span><b>Market Value</b><span>Rs. {report.market_value ?? "—"}</span></div>
          <div className="report-row"><span>(4)</span><b>Required Stamp Duty</b><span>Rs. {report.required_stamp_duty ?? "—"}</span></div>
          <div className="report-row"><span>(5)</span><b>Date of Execution</b><span>{fmtDate(report.date_of_execution)}</span></div>
          <div className="report-row"><span>(6)</span><b>Village Name</b><span>{report.village_name || "—"}</span></div>
          <div className="report-row"><span>(7)</span><b>Number of Pages</b><span>{report.number_of_pages ?? "—"}</span></div>
          <div className="report-row"><span>(8)</span><b>Survey/C.T.S. Number(s)</b><span>{report.survey_cts_numbers?.join(", ") || "—"}</span></div>
          <div className="report-row"><span>(9)</span><b>Tenure Type</b><span>{report.tenure_and_area || "—"}</span></div>
          <div className="report-row"><span>(10)</span><b>Area</b><span>{report.area ?? "—"}</span></div>
          <div className="report-row">
            <span>(11)</span><b>Executant Details</b>
            <span>{report.executants?.length ? report.executants.map((p, i) => <div key={i}>{i + 1}) {fmtParty(p)}</div>) : "—"}</span>
          </div>
          <div className="report-row">
            <span>(12)</span><b>Claimant Details</b>
            <span>{report.claimants?.length ? report.claimants.map((p, i) => <div key={i}>{i + 1}) {fmtParty(p)}</div>) : "—"}</span>
          </div>
          <div className="report-row">
            <span>(13)</span><b>Witness Details</b>
            <span>{report.witnesses?.length ? report.witnesses.map((p, i) => <div key={i}>{i + 1}) {fmtParty(p)}</div>) : "—"}</span>
          </div>

          <div className="report-note">
            Any changes to be made — please use Previous. Once data entry is completed, take a printout of this
            report or note down the Token Number. This data entry does not mean the document is accepted for
            registration; the SRO officer has authority to reject or modify it per the applicable rules.
          </div>
        </div>

        <div className="entry-actions">
          <button type="button" className="btn btn-blue" onClick={() => navigate(`/entries/${id}/identifications`)}>Previous</button>
          <button type="button" className="btn btn-outline" onClick={() => window.print()}>Print</button>
          <button type="button" className="btn btn-green" onClick={handleNext} disabled={completing}>
            {completing ? "Submitting…" : "Next"}
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
