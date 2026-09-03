import React, { useState, useEffect } from "react";
import schemeApi from "../../../api/schemeApi";

const DOCUMENT_SLOTS = [
  { type: "7/12 Extract / Index II", required: true, desc: "Revenue record or property index extract" },
  { type: "MahaRERA Certificate", required: true, desc: "Project registration certificate issued by MahaRERA" },
  { type: "Approved Layout / Sanction Plan", required: true, desc: "Building sanction and layout approval by authority" },
  { type: "Title & Search Certificate", required: true, desc: "Advocate certificate certifying clear and marketable title" },
  { type: "Power of Attorney (POA)", required: false, desc: "POA deed if representative is acting on seller's behalf" },
  { type: "Draft Agreement Format", required: false, desc: "Model agreement for sale / draft agreement" },
  { type: "Other Supporting Document", required: false, desc: "Supplementary documents / approvals" },
];

export default function UploadDocument({ schemeId, scheme, onNext, onBack }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingSlot, setUploadingSlot] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchDocuments = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await schemeApi.getDocuments(schemeId);
      setDocuments(res.data || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (schemeId) fetchDocuments();
  }, [schemeId]);

  const handleFileUpload = async (slotType, file) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Invalid file format. Only PDF files (.pdf) are allowed.");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      alert("File is too large. Maximum size is 20MB.");
      return;
    }

    setUploadingSlot(slotType);
    setError("");
    setSuccess("");

    try {
      await schemeApi.uploadDocument(schemeId, slotType, file);
      setSuccess(`Document '${slotType}' uploaded successfully.`);
      setTimeout(() => setSuccess(""), 3000);
      fetchDocuments();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || `Failed to upload ${slotType}.`);
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleDelete = async (docId, docName) => {
    if (!window.confirm(`Are you sure you want to delete ${docName}?`)) return;
    try {
      await schemeApi.deleteDocument(schemeId, docId);
      fetchDocuments();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete document.");
    }
  };

  const getDocForSlot = (slotType) => {
    return documents.find((d) => d.document_type === slotType && d.is_active);
  };

  const hasMandatoryDocs = DOCUMENT_SLOTS.filter((s) => s.required).every((s) =>
    Boolean(getDocForSlot(s.type))
  );

  return (
    <div className="step-card">
      <div className="step-card-header">
        <div>
          <h2 className="step-title">Step 3: Upload Document / कागदपत्रे अपलोड करा</h2>
          <p className="step-desc">
            Upload verified PDF documents supporting the scheme registration and ownership verification.
          </p>
        </div>
      </div>

      {error && <div className="scheme-error-box">{error}</div>}
      {success && <div className="scheme-success-box">{success}</div>}

      <div className="step-slots-grid">
        {DOCUMENT_SLOTS.map((slot) => {
          const doc = getDocForSlot(slot.type);
          const isUploading = uploadingSlot === slot.type;

          return (
            <div
              key={slot.type}
              className={`document-slot-card ${doc ? "slot-uploaded" : slot.required ? "slot-required" : ""}`}
            >
              <div className="slot-header">
                <div>
                  <h4 className="slot-title">
                    {slot.type} {slot.required && <span className="text-red-500">*</span>}
                  </h4>
                  <p className="slot-desc">{slot.desc}</p>
                </div>
                {doc ? (
                  <span className="scheme-badge badge-approved">Uploaded (v{doc.version})</span>
                ) : slot.required ? (
                  <span className="scheme-badge badge-draft">Required</span>
                ) : (
                  <span className="scheme-badge text-muted">Optional</span>
                )}
              </div>

              {doc ? (
                <div className="slot-file-info">
                  <div className="text-sm font-semibold truncate text-slate-700">
                    📄 {doc.document_name}
                  </div>
                  <div className="text-xs text-muted">
                    Size: {(doc.file_size / 1024).toFixed(1)} KB | Uploaded:{" "}
                    {new Date(doc.created_at).toLocaleDateString()}
                  </div>
                  <div className="slot-actions">
                    <a
                      href={schemeApi.downloadDocumentUrl(schemeId, doc.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-xs mr-2"
                    >
                      Download / View
                    </a>
                    <label className="btn btn-secondary btn-xs mr-2 cursor-pointer">
                      Replace
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleFileUpload(slot.type, e.target.files[0]);
                        }}
                      />
                    </label>
                    <button
                      className="btn btn-secondary btn-xs text-red-600"
                      onClick={() => handleDelete(doc.id, doc.document_name)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div className="slot-upload-dropzone">
                  <label className="btn btn-primary btn-sm cursor-pointer">
                    {isUploading ? "Uploading..." : "Select PDF Document"}
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      disabled={isUploading}
                      style={{ display: "none" }}
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleFileUpload(slot.type, e.target.files[0]);
                      }}
                    />
                  </label>
                  <span className="text-xs text-muted ml-2">PDF only, max 20MB</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="step-footer-actions">
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back to Identifier
        </button>
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={documents.length === 0}
        >
          Next: Create Template →
        </button>
      </div>
    </div>
  );
}
