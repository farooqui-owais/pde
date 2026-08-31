import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios.js";
import HeaderSarita from "../components/HeaderSarita.jsx";
import Footer from "../components/Footer.jsx";
import StampPaymentModal from "../components/StampPaymentModal.jsx";
import "./DocumentEntry.css";

const todayIso = new Date().toISOString().slice(0, 10);

export default function DocumentEntry() {
  const { t } = useTranslation(["pages", "common"]);
  const { state } = useLocation();
  const navigate = useNavigate();

  const [tokenId, setTokenId] = useState(state?.tokenId || "");
  const [entryId, setEntryId] = useState(state?.entryId || "");
  const [showModal, setShowModal] = useState(true);
  const [showStampModal, setShowStampModal] = useState(false);
  const [articleTypes, setArticleTypes] = useState([]);
  const [documentTitles, setDocumentTitles] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    article_type_id: "",
    document_title: "",
    date_of_execution: todayIso,
    date_of_presentation: todayIso,
    market_value: "",
    consideration_amount: "",
    number_of_pages: "",
  });
  const [stampDuty, setStampDuty] = useState(null);

  useEffect(() => {
    api.get("/api/reference/article-types").then((r) => setArticleTypes(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!tokenId) {
      api.post("/api/tokens", { language: "\u092e\u0930\u093e\u0920\u0940" })
        .then((r) => setTokenId(r.data.id))
        .catch(() => setError(t("document.couldNotOpenToken")));
    }
  }, [tokenId]);

  useEffect(() => {
    if (form.article_type_id) {
      api.get("/api/reference/document-titles", { params: { article_type_id: form.article_type_id } })
        .then((r) => {
          setDocumentTitles(r.data);
          if (r.data.length && !form.document_title) {
            update("document_title", r.data[0].label_marathi);
          }
        })
        .catch(() => setDocumentTitles([]));
    } else {
      setDocumentTitles([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.article_type_id]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function buildPayload() {
    return {
      token_id: tokenId,
      article_type_id: form.article_type_id ? Number(form.article_type_id) : null,
      document_title: form.document_title || null,
      date_of_execution: form.date_of_execution || null,
      date_of_presentation: form.date_of_presentation || null,
      market_value: form.market_value || null,
      consideration_amount: form.consideration_amount || null,
      number_of_pages: form.number_of_pages ? Number(form.number_of_pages) : null,
    };
  }

  /** Create the entry on first save, update it on later saves — needed
   *  before opening the Rent Terms or Stamp Payment sub-screens. */
  async function ensureEntrySaved() {
    if (entryId) {
      await api.put(`/api/documents/${entryId}`, buildPayload());
      return entryId;
    }
    const { data } = await api.post("/api/documents", buildPayload());
    setEntryId(data.id);
    return data.id;
  }

  async function calculateStampDuty() {
    if (!form.market_value || !form.consideration_amount) return;
    try {
      const { data } = await api.post("/api/documents/calculate-stamp-duty", {
        market_value: form.market_value,
        consideration_amount: form.consideration_amount,
        article_type_id: form.article_type_id || null,
      });
      setStampDuty(data);
    } catch {
      setStampDuty(null);
    }
  }

  async function openStampDetails() {
    setError("");
    try {
      await ensureEntrySaved();
      setShowStampModal(true);
    } catch (err) {
      setError(err?.response?.data?.detail || t("document.couldNotOpenStampDetails"));
    }
  }

  const selectedArticle = articleTypes.find((a) => String(a.id) === String(form.article_type_id));

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!tokenId) { setError(t("document.noEntryToken")); return; }
    setSaving(true);
    try {
      const id = await ensureEntrySaved();
      setSuccess(t("document.savedPresentation"));
      if (selectedArticle?.has_rent_terms) {
        navigate(`/entries/${id}/rent-terms`);
      } else {
        navigate(`/entries/${id}/properties`);
      }
    } catch (err) {
      setError(err?.response?.data?.detail || t("document.couldNotSave"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-shell">
      <HeaderSarita />
      <div className="page-body entry-body">
        <h1 className="entry-title">{t("document.title")}</h1>
        <div className="entry-hint">{t("document.hint")}</div>

        {showModal && (
          <div className="entry-modal-backdrop" onClick={() => setShowModal(false)}>
            <div className="entry-modal" onClick={(e) => e.stopPropagation()}>
              <div className="ledger-rule" />
              <p>
                {t("document.modalText")}
              </p>
              <div className="ledger-rule" />
              <button className="btn btn-red" onClick={() => setShowModal(false)}>{t("document.closeX")}</button>
            </div>
          </div>
        )}

        {error && <div className="banner banner-error">{error}</div>}
        {success && <div className="banner banner-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="entry-grid">
            <label>{t("document.selectArticle")}</label>
            <select value={form.article_type_id} onChange={(e) => update("article_type_id", e.target.value)} required>
              <option value="">{t("document.selectArticleOption")}</option>
              {articleTypes.map((a) => (
                <option key={a.id} value={a.id}>{a.code}-{a.name}</option>
              ))}
            </select>
            <label>{t("document.documentTitle")}</label>
            <select value={form.document_title} onChange={(e) => update("document_title", e.target.value)}>
              <option value="">{t("document.selectArticleDesc")}</option>
              {documentTitles.map((t) => (
                <option key={t.id} value={t.label_marathi}>{t.label_marathi}</option>
              ))}
            </select>

            <label>{t("document.dateOfExecution")}</label>
            <input type="date" value={form.date_of_execution} onChange={(e) => update("date_of_execution", e.target.value)} />
            <span />
            <span />

            <label>{t("document.dateOfPresentation")}</label>
            <input type="date" value={form.date_of_presentation} onChange={(e) => update("date_of_presentation", e.target.value)} />
            <span />
            <span />

            <label>{t("document.marketValue")}</label>
            <input type="number" min="0" value={form.market_value} onChange={(e) => update("market_value", e.target.value)} onBlur={calculateStampDuty} />
            <span />
            <span />

            <label>{t("document.considerationAmount")}</label>
            <input type="number" min="0" value={form.consideration_amount} onChange={(e) => update("consideration_amount", e.target.value)} onBlur={calculateStampDuty} />
            <span />
            <span />

            <label>{t("document.stampDuty")}</label>
            <input readOnly value={stampDuty ? `\u20b9 ${stampDuty.stamp_duty}` : ""} />
            <button type="button" className="btn btn-blue" onClick={calculateStampDuty}>{t("document.calculateStampDuty")}</button>
            <span />

            <label>{t("document.noOfPages")}</label>
            <input type="number" min="0" value={form.number_of_pages} onChange={(e) => update("number_of_pages", e.target.value)} />
            <span className="entry-hint-inline">{t("document.excludingSummary")}</span>
            <span />

            <label>{t("document.stampDutyPaid")}</label>
            <input readOnly value={stampDuty ? `\u20b9 ${stampDuty.stamp_duty}` : ""} />
            <button type="button" className="btn btn-outline" onClick={openStampDetails}>{t("document.stampDutyPayDetails")}</button>
            <span />

            <label>{t("document.stampDutyDifference")}</label>
            <input readOnly value="0.00" />
            <span /><span />

            {stampDuty && (
              <div className="stamp-box">
                {t("document.estimatedAt", { rate: stampDuty.rate_percent })} Need the full
                clause-by-clause breakdown?{" "}
                <a href="#" onClick={(e) => { e.preventDefault(); navigate("/stamp-duty-calculate"); }}>
                  {t("document.openStampDutyCalculate")}
                </a>
              </div>
            )}
          </div>

          <div className="entry-notice-red">{t("document.receiptOnPresentor")}</div>

          <div className="entry-actions">
            <button type="button" className="btn btn-blue" onClick={() => navigate("/dashboard")}>{t("common:previous")}</button>
            <button type="submit" className="btn btn-green" disabled={saving}>
              {saving ? t("common:saving") : t("common:next")}
            </button>
          </div>

        </form>
      </div>

      {showStampModal && entryId && (
        <StampPaymentModal
          documentEntryId={entryId}
          defaultAmount={stampDuty?.stamp_duty}
          onClose={() => setShowStampModal(false)}
        />
      )}

      <Footer office={{ dig: "Pune", jdr: "Pune", sro: "Joint S.R. Haveli 14" }} />
    </div>
  );
}
