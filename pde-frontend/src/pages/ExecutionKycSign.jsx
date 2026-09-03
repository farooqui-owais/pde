import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios.js";
import verificationApi from "../api/verificationApi.js";
import HeaderSarita from "../components/HeaderSarita.jsx";
import Footer from "../components/Footer.jsx";
import "./EntrySteps.css";
import "./ExecutionKycSign.css";

const CAPTURE_TYPES = ["PHOTO", "FINGERPRINT", "SIGNATURE_PAD"];
const EKYC_TYPES = ["OTP", "BIOMETRIC"];
const SIGN_METHODS = ["ESIGN", "WET_INK_UPLOAD"];

export default function ExecutionKycSign() {
  const { t } = useTranslation(["pages", "common"]);
  const { id } = useParams();
  const navigate = useNavigate();

  const [parties, setParties] = useState([]);
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [error, setError] = useState("");

  const [captures, setCaptures] = useState([]);
  const [captureType, setCaptureType] = useState(CAPTURE_TYPES[0]);

  const [ekycList, setEkycList] = useState([]);
  const [ekycType, setEkycType] = useState(EKYC_TYPES[0]);
  const [ekycProvider, setEkycProvider] = useState("");
  const [ekycIdentifier, setEkycIdentifier] = useState("");

  const [agreements, setAgreements] = useState([]);
  const [signMethod, setSignMethod] = useState(SIGN_METHODS[0]);

  async function loadAll() {
    try {
      const [partiesRes, capturesRes, ekycRes, agreementsRes] = await Promise.all([
        api.get(`/api/documents/${id}/parties`),
        verificationApi.listExecutionCaptures(id),
        verificationApi.listEkycVerifications(id),
        verificationApi.listSignAgreements(id),
      ]);
      setParties(partiesRes.data);
      setCaptures(capturesRes.data);
      setEkycList(ekycRes.data);
      setAgreements(agreementsRes.data);
    } catch (err) {
      setError(err?.response?.data?.detail || t("execution.couldNotLoad"));
    }
  }

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [id]);

  function partyLabel(partyId) {
    const p = parties.find((x) => x.id === partyId);
    if (!p) return "—";
    return `${p.first_name_en || ""} ${p.surname_en || ""}`.trim() || "—";
  }

  async function handleAddCapture() {
    setError("");
    try {
      await verificationApi.addExecutionCapture(id, {
        party_id: selectedPartyId || null,
        capture_type: captureType,
      });
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.detail || t("execution.couldNotSave"));
    }
  }

  async function handleDeleteCapture(captureId) {
    try {
      await verificationApi.deleteExecutionCapture(captureId);
      await loadAll();
    } catch { /* ignore */ }
  }

  async function handleStartEkyc() {
    setError("");
    try {
      await verificationApi.startEkycVerification(id, {
        party_id: selectedPartyId || null,
        provider: ekycProvider || null,
        verification_type: ekycType,
        identifier: ekycIdentifier || null,
      });
      setEkycIdentifier("");
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.detail || t("execution.couldNotSave"));
    }
  }

  async function handleEkycStatus(verificationId, status) {
    try {
      await verificationApi.updateEkycStatus(verificationId, { status });
      await loadAll();
    } catch { /* ignore */ }
  }

  async function handleCreateAgreement() {
    setError("");
    try {
      await verificationApi.createSignAgreement(id, {
        party_id: selectedPartyId || null,
        method: signMethod,
      });
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.detail || t("execution.couldNotSave"));
    }
  }

  async function handleAgreementStatus(agreementId, status) {
    try {
      await verificationApi.updateSignAgreementStatus(agreementId, { status });
      await loadAll();
    } catch { /* ignore */ }
  }

  return (
    <div className="page-shell">
      <HeaderSarita />
      <div className="page-body entry-body">
        <h1 className="entry-title">{t("execution.title")}</h1>
        <div className="banner banner-info">{t("execution.tbdNotice")}</div>
        {error && <div className="banner banner-error">{error}</div>}

        <div className="entry-grid" style={{ marginBottom: 16 }}>
          <label>{t("execution.selectParty")}</label>
          <select className="span2" value={selectedPartyId} onChange={(e) => setSelectedPartyId(e.target.value)}>
            <option value="">{t("execution.selectPartyOption")}</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>{`${p.first_name_en || ""} ${p.surname_en || ""}`.trim() || p.id}</option>
            ))}
          </select>
          <span />
        </div>

        {/* Execution Capture */}
        <section className="eks-section">
          <h2 className="eks-section-title">{t("execution.captureTitle")}</h2>
          <div className="eks-row">
            <select value={captureType} onChange={(e) => setCaptureType(e.target.value)}>
              {CAPTURE_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button type="button" className="btn btn-green" onClick={handleAddCapture}>{t("execution.captureAction")}</button>
          </div>
          <table className="step-table">
            <thead>
              <tr><th>{t("execution.colParty")}</th><th>{t("execution.colType")}</th><th>{t("common:select")}</th><th>{t("common:delete")}</th></tr>
            </thead>
            <tbody>
              {captures.length === 0 && <tr><td colSpan={4} style={{ color: "#777" }}>{t("execution.noCaptures")}</td></tr>}
              {captures.map((c) => (
                <tr key={c.id}>
                  <td>{partyLabel(c.party_id)}</td>
                  <td>{c.capture_type}</td>
                  <td>{c.status}</td>
                  <td><a href="#" onClick={(e) => { e.preventDefault(); handleDeleteCapture(c.id); }}>{t("common:delete")}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* eKYC */}
        <section className="eks-section">
          <h2 className="eks-section-title">{t("execution.ekycTitle")}</h2>
          <div className="eks-row">
            <select value={ekycType} onChange={(e) => setEkycType(e.target.value)}>
              {EKYC_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input placeholder={t("execution.providerPlaceholder")} value={ekycProvider} onChange={(e) => setEkycProvider(e.target.value)} />
            <input placeholder={t("execution.identifierPlaceholder")} value={ekycIdentifier} onChange={(e) => setEkycIdentifier(e.target.value)} />
            <button type="button" className="btn btn-green" onClick={handleStartEkyc}>{t("execution.ekycAction")}</button>
          </div>
          <p className="entry-hint-inline">{t("execution.ekycMaskNote")}</p>
          <table className="step-table">
            <thead>
              <tr><th>{t("execution.colParty")}</th><th>{t("execution.colType")}</th><th>{t("execution.colMasked")}</th><th>{t("common:select")}</th><th>{t("execution.colAction")}</th></tr>
            </thead>
            <tbody>
              {ekycList.length === 0 && <tr><td colSpan={5} style={{ color: "#777" }}>{t("execution.noEkyc")}</td></tr>}
              {ekycList.map((v) => (
                <tr key={v.id}>
                  <td>{partyLabel(v.party_id)}</td>
                  <td>{v.verification_type || "—"}</td>
                  <td>{v.masked_identifier || "—"}</td>
                  <td>{v.status}</td>
                  <td>
                    {v.status === "PENDING" && (
                      <>
                        <a href="#" onClick={(e) => { e.preventDefault(); handleEkycStatus(v.id, "VERIFIED"); }}>{t("execution.markVerified")}</a>
                        {" / "}
                        <a href="#" onClick={(e) => { e.preventDefault(); handleEkycStatus(v.id, "FAILED"); }}>{t("execution.markFailed")}</a>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Sign Agreement */}
        <section className="eks-section">
          <h2 className="eks-section-title">{t("execution.signTitle")}</h2>
          <div className="eks-row">
            <select value={signMethod} onChange={(e) => setSignMethod(e.target.value)}>
              {SIGN_METHODS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button type="button" className="btn btn-green" onClick={handleCreateAgreement}>{t("execution.signAction")}</button>
          </div>
          <table className="step-table">
            <thead>
              <tr><th>{t("execution.colParty")}</th><th>{t("execution.colMethod")}</th><th>{t("common:select")}</th><th>{t("execution.colAction")}</th></tr>
            </thead>
            <tbody>
              {agreements.length === 0 && <tr><td colSpan={4} style={{ color: "#777" }}>{t("execution.noAgreements")}</td></tr>}
              {agreements.map((a) => (
                <tr key={a.id}>
                  <td>{partyLabel(a.party_id)}</td>
                  <td>{a.method || "—"}</td>
                  <td>{a.status}</td>
                  <td>
                    {a.status === "PENDING" && (
                      <>
                        <a href="#" onClick={(e) => { e.preventDefault(); handleAgreementStatus(a.id, "SIGNED"); }}>{t("execution.markSigned")}</a>
                        {" / "}
                        <a href="#" onClick={(e) => { e.preventDefault(); handleAgreementStatus(a.id, "DECLINED"); }}>{t("execution.markDeclined")}</a>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="entry-actions">
          <button type="button" className="btn btn-blue" onClick={() => navigate(`/entries/${id}/confirmation`)}>{t("common:back")}</button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
