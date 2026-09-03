import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import HeaderSarita from "../../components/HeaderSarita";
import Footer from "../../components/Footer";
import schemeApi from "../../api/schemeApi";

import SchemeSellerEntry from "./steps/SchemeSellerEntry";
import SchemeIdentifier from "./steps/SchemeIdentifier";
import UploadDocument from "./steps/UploadDocument";
import CreateTemplate from "./steps/CreateTemplate";
import SubmitScheme from "./steps/SubmitScheme";

import "./SchemeWorkflow.css";

const STEPS = [
  { number: 1, title: "Seller Entry", desc: "विक्रेता तपशील" },
  { number: 2, title: "Scheme Identifier", desc: "ओळखकर्ता तपशील" },
  { number: 3, title: "Upload Document", desc: "कागदपत्रे अपलोड" },
  { number: 4, title: "Create Template", desc: "डीड टेम्पलेट" },
  { number: 5, title: "Submit Scheme", desc: "योजना सादर करा" },
];

export default function SchemeDetail() {
  const { schemeId, stepNumber } = useParams();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") || "view";
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(parseInt(stepNumber) || 1);
  const [scheme, setScheme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchScheme = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await schemeApi.getScheme(schemeId);
      setScheme(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to load scheme details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (schemeId) fetchScheme();
  }, [schemeId]);

  useEffect(() => {
    if (stepNumber) {
      setCurrentStep(parseInt(stepNumber));
    }
  }, [stepNumber]);

  const goToStep = (step) => {
    if (step < 1 || step > 5) return;
    setCurrentStep(step);
    navigate(`/schemes/${schemeId}/steps/${step}${mode === "modify" ? "?mode=modify" : ""}`);
  };

  return (
    <div className="scheme-workflow-wrapper">
      <HeaderSarita />

      <div className="workflow-container">
        {/* Breadcrumb & Navigation */}
        <div className="workflow-top-bar">
          <div className="workflow-breadcrumbs">
            <button className="breadcrumb-link" onClick={() => navigate("/dashboard")}>
              Dashboard
            </button>
            <span className="breadcrumb-separator">/</span>
            <button className="breadcrumb-link" onClick={() => navigate("/schemes")}>
              Scheme Details
            </button>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">
              {scheme?.scheme_name || "Scheme Workflow"}
            </span>
          </div>

          <div className="workflow-meta">
            {scheme && (
              <span className="scheme-info-badge">
                Form ID: <strong>{scheme.scheme_number || scheme.id.substring(0, 8)}</strong> | Project:{" "}
                <strong>{scheme.project_name || "—"}</strong>
                {mode === "modify" && <span className="modify-tag">Modify Mode</span>}
              </span>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => navigate("/schemes")}>
              Exit to Scheme List
            </button>
          </div>
        </div>

        {/* Stepper Header */}
        <div className="workflow-stepper">
          {STEPS.map((s) => {
            const isCompleted = currentStep > s.number;
            const isCurrent = currentStep === s.number;
            return (
              <div
                key={s.number}
                className={`stepper-step ${isCurrent ? "step-active" : isCompleted ? "step-completed" : "step-pending"}`}
                onClick={() => goToStep(s.number)}
              >
                <div className="step-circle">{isCompleted ? "✓" : s.number}</div>
                <div className="step-label-group">
                  <span className="step-title-text">{s.title}</span>
                  <span className="step-desc-text">{s.desc}</span>
                </div>
              </div>
            );
          })}
        </div>

        {error && <div className="scheme-error-box mt-4">{error}</div>}

        {/* Step Content */}
        <div className="workflow-content mt-4">
          {loading ? (
            <div className="text-center py-12 text-muted">Loading scheme details...</div>
          ) : (
            <>
              {currentStep === 1 && (
                <SchemeSellerEntry
                  schemeId={schemeId}
                  scheme={scheme}
                  onNext={() => goToStep(2)}
                />
              )}
              {currentStep === 2 && (
                <SchemeIdentifier
                  schemeId={schemeId}
                  scheme={scheme}
                  onNext={() => goToStep(3)}
                  onBack={() => goToStep(1)}
                />
              )}
              {currentStep === 3 && (
                <UploadDocument
                  schemeId={schemeId}
                  scheme={scheme}
                  onNext={() => goToStep(4)}
                  onBack={() => goToStep(2)}
                />
              )}
              {currentStep === 4 && (
                <CreateTemplate
                  schemeId={schemeId}
                  scheme={scheme}
                  onNext={() => goToStep(5)}
                  onBack={() => goToStep(3)}
                />
              )}
              {currentStep === 5 && (
                <SubmitScheme
                  schemeId={schemeId}
                  scheme={scheme}
                  onBack={() => goToStep(4)}
                />
              )}
            </>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
