import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import schemeApi from "../../../api/schemeApi";

export default function SubmitScheme({ schemeId, scheme, onBack }) {
  const navigate = useNavigate();
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(scheme?.status === "submitted");

  const checkReadiness = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await schemeApi.checkSubmissionReadiness(schemeId);
      setReadiness(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to verify submission prerequisites.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (schemeId) checkReadiness();
  }, [schemeId]);

  const handleSubmit = async () => {
    if (!readiness?.can_submit) {
      alert("Please resolve all missing prerequisites before submitting.");
      return;
    }
    if (!window.confirm("Are you sure you want to submit this Scheme for official verification?")) return;

    setSubmitting(true);
    setError("");
    try {
      await schemeApi.submitScheme(schemeId);
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail;
      if (typeof detail === "object" && detail.errors) {
        setError(`Prerequisites failed: ${detail.errors.join(", ")}`);
      } else {
        setError(typeof detail === "string" ? detail : "Failed to submit scheme.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="step-card">
      <div className="step-card-header">
        <div>
          <h2 className="step-title">Step 5: Submit Scheme / योजना सादर करा</h2>
          <p className="step-desc">
            Verify all prerequisite details and submit the scheme for official registration and template activation.
          </p>
        </div>
      </div>

      {error && <div className="scheme-error-box">{error}</div>}

      {submitted ? (
        <div className="submission-success-card">
          <div className="success-icon">✓</div>
          <h3 className="success-title">Scheme Submitted Successfully!</h3>
          <p className="success-desc">
            Scheme <strong>{scheme?.scheme_name}</strong> (Form ID: <strong>{scheme?.scheme_number}</strong>) has
            been locked and submitted for departmental verification.
          </p>
          <div className="flex justify-center gap-3 mt-4">
            <button className="btn btn-primary" onClick={() => navigate("/schemes")}>
              View Scheme Details List
            </button>
            <button className="btn btn-secondary" onClick={() => navigate("/dashboard")}>
              Return to Dashboard
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Card */}
          <div className="scheme-summary-card mb-4">
            <h4 className="font-bold text-slate-800 mb-2">Scheme Overview</h4>
            <div className="summary-grid">
              <div>
                <span className="summary-label">Project:</span>
                <span className="summary-val">{scheme?.project_name || scheme?.project?.project_name || "—"}</span>
              </div>
              <div>
                <span className="summary-label">Scheme Name:</span>
                <span className="summary-val">{scheme?.scheme_name}</span>
              </div>
              <div>
                <span className="summary-label">MahaRERA No:</span>
                <span className="summary-val">{scheme?.maha_rera_number || "—"}</span>
              </div>
              <div>
                <span className="summary-label">Article / Type:</span>
                <span className="summary-val">{scheme?.article || "Conveyance"}</span>
              </div>
              <div>
                <span className="summary-label">Document Title:</span>
                <span className="summary-val">{scheme?.document_title || "Sale Deed"}</span>
              </div>
              <div>
                <span className="summary-label">Current Status:</span>
                <span className="summary-val font-bold uppercase">{scheme?.status || "DRAFT"}</span>
              </div>
            </div>
          </div>

          {/* Prerequisites Checklist */}
          <div className="readiness-checklist-card">
            <h4 className="font-bold text-slate-800 mb-3">Pre-Submission Validation Checklist</h4>
            {loading ? (
              <div className="py-4 text-center text-muted">Checking prerequisites with server...</div>
            ) : readiness ? (
              <div className="checklist-items">
                <div className={`checklist-row ${readiness.has_seller_parties ? "row-passed" : "row-failed"}`}>
                  <span className="check-icon">{readiness.has_seller_parties ? "✓" : "✗"}</span>
                  <div className="check-content">
                    <span className="font-semibold">1. Scheme Seller Parties</span>
                    <span className="text-xs text-muted block">
                      {readiness.seller_parties_count} seller parties registered
                    </span>
                  </div>
                </div>

                <div className={`checklist-row ${readiness.has_identifier ? "row-passed" : "row-failed"}`}>
                  <span className="check-icon">{readiness.has_identifier ? "✓" : "✗"}</span>
                  <div className="check-content">
                    <span className="font-semibold">2. Scheme Identifier Details</span>
                    <span className="text-xs text-muted block">
                      {readiness.has_identifier ? "Identifier recorded" : "Missing identifier details"}
                    </span>
                  </div>
                </div>

                <div className={`checklist-row ${readiness.has_mandatory_documents ? "row-passed" : "row-failed"}`}>
                  <span className="check-icon">{readiness.has_mandatory_documents ? "✓" : "✗"}</span>
                  <div className="check-content">
                    <span className="font-semibold">3. Mandatory PDF Documents</span>
                    <span className="text-xs text-muted block">
                      {readiness.documents_count} documents uploaded
                    </span>
                  </div>
                </div>

                <div className={`checklist-row ${readiness.has_templates ? "row-passed" : "row-failed"}`}>
                  <span className="check-icon">{readiness.has_templates ? "✓" : "✗"}</span>
                  <div className="check-content">
                    <span className="font-semibold">4. Deed Document Templates</span>
                    <span className="text-xs text-muted block">
                      {readiness.templates_count} active templates configured
                    </span>
                  </div>
                </div>

                {readiness.errors && readiness.errors.length > 0 && (
                  <div className="checklist-errors mt-3">
                    <div className="font-bold text-xs text-red-700 mb-1">Attention Required:</div>
                    <ul className="text-xs text-red-600 list-disc pl-4">
                      {readiness.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="step-footer-actions mt-4">
            <button className="btn btn-secondary" onClick={onBack}>
              ← Back to Templates
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={submitting || !readiness?.can_submit}
            >
              {submitting ? "Submitting..." : "Submit Scheme to Department →"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
