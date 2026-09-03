import React, { useState, useEffect } from "react";
import schemeApi from "../../../api/schemeApi";

export default function PreviewTemplateModal({ template, scheme, isOpen, onClose }) {
  const [renderedHtml, setRenderedHtml] = useState("");
  const [tokensReplaced, setTokensReplaced] = useState([]);
  const [missingTokens, setMissingTokens] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && template) {
      fetchPreview();
    }
  }, [isOpen, template]);

  const fetchPreview = async () => {
    setLoading(true);
    try {
      if (template.id) {
        const res = await schemeApi.previewTemplate(template.id, {
          template_content: template.template_content,
        });
        setRenderedHtml(res.data.rendered_html);
        setTokensReplaced(res.data.tokens_replaced || []);
        setMissingTokens(res.data.missing_tokens || []);
      } else {
        // Fallback local substitution
        let content = template.template_content || "";
        const sample = {
          "project.project_name": scheme?.project?.project_name || "Royal Palms Residency",
          "scheme.scheme_name": scheme?.scheme_name || "Tower A - Phase 1",
          "property.flat_number": "Flat 304, 3rd Floor",
          "seller.name": "M/s Apex Infrastructure Pvt Ltd",
          "party.full_name": "Suresh Anant Kulkarni",
          "document.consideration_amount": "Rs. 65,00,000/-",
          "document.stamp_duty": "Rs. 3,90,000/-",
        };
        for (const [k, v] of Object.entries(sample)) {
          content = content.replaceAll(`{{${k}}}`, v);
        }
        setRenderedHtml(content);
      }
    } catch (err) {
      console.error("Preview error", err);
      setRenderedHtml(template?.template_content || "");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="scheme-modal-backdrop">
      <div className="scheme-modal scheme-modal-lg preview-modal">
        <div className="scheme-modal-header">
          <div>
            <h3>Preview Deed Document: {template?.template_name}</h3>
            <span className="text-xs text-muted">Rendered with sample scheme and property values</span>
          </div>
          <button className="scheme-modal-close" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="scheme-modal-body preview-modal-body">
          {loading ? (
            <div className="text-center py-8 text-muted">Rendering preview...</div>
          ) : (
            <>
              {tokensReplaced.length > 0 && (
                <div className="preview-meta-chips mb-3">
                  <span className="text-xs font-semibold text-slate-600 mr-2">Replaced Tokens:</span>
                  {tokensReplaced.map((t) => (
                    <span key={t} className="token-chip-success">
                      ✓ {t}
                    </span>
                  ))}
                </div>
              )}

              {missingTokens.length > 0 && (
                <div className="preview-meta-chips mb-3">
                  <span className="text-xs font-semibold text-amber-700 mr-2">Unmatched Tokens:</span>
                  {missingTokens.map((t) => (
                    <span key={t} className="token-chip-warning">
                      ⚠ {t}
                    </span>
                  ))}
                </div>
              )}

              <div
                className="rendered-deed-paper"
                dangerouslySetInnerHTML={{ __html: renderedHtml || "<p>No content in template.</p>" }}
              />
            </>
          )}
        </div>

        <div className="scheme-modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close Preview
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              window.print();
            }}
          >
            🖨 Print / Export PDF
          </button>
        </div>
      </div>
    </div>
  );
}
