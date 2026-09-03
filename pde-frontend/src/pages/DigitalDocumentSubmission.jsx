import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios.js";
import HeaderSarita from "../components/HeaderSarita.jsx";
import Footer from "../components/Footer.jsx";
import { formatApiValidationError, validatePdfFile } from "../utils/validation.js";
import "./DigitalDocumentSubmission.css";

const DRAFT_CATEGORIES = [
  "Digital Document (without Execution Page)",
  "Digital Execution Page (without sign)",
];

const ID_PROOFS = ["Aadhar Card", "PAN Card", "Passport", "Voter ID", "Driving Licence"];

export default function DigitalDocumentSubmission() {
  const { t } = useTranslation(["pages", "common", "validation"]);
  const { id } = useParams();
  const navigate = useNavigate();

  const [showInfoModal, setShowInfoModal] = useState(false);

  // Top Preference
  const [wantsDigital, setWantsDigital] = useState(false);

  // Section 1: Draft Files
  const [draftCategory, setDraftCategory] = useState(DRAFT_CATEGORIES[0]);
  const [draftFile, setDraftFile] = useState(null);
  const [draftList, setDraftList] = useState([]);
  const [uploadingDraft, setUploadingDraft] = useState(false);

  // Section 2: Annexure Files
  const [annexureTitle, setAnnexureTitle] = useState("Scanned Required Annexure");
  const [annexureTitleOther, setAnnexureTitleOther] = useState("");
  const [poaName, setPoaName] = useState("");
  const [poaPrinciple, setPoaPrinciple] = useState("");
  const [annexureFile, setAnnexureFile] = useState(null);
  const [annexureList, setAnnexureList] = useState([]);
  const [uploadingAnnexure, setUploadingAnnexure] = useState(false);

  // Section 3: Party Files
  const [partyList, setPartyList] = useState([]);
  const [selectedPartyId, setSelectedPartyId] = useState(null);
  const [identityProofType, setIdentityProofType] = useState("Aadhar Card");
  const [identityFile, setIdentityFile] = useState(null);
  const [panFile, setPanFile] = useState(null);
  const [uploadingPartyDoc, setUploadingPartyDoc] = useState(false);

  // General Status
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function loadAll() {
    try {
      const [prefRes, draftsRes, annexRes, partiesRes] = await Promise.all([
        api.get(`/api/documents/${id}/digital-submission-preference`).catch(() => ({ data: { wants_digital_submission: false } })),
        api.get(`/api/documents/${id}/draft-files`).catch(() => ({ data: [] })),
        api.get(`/api/documents/${id}/annexure-files`).catch(() => ({ data: [] })),
        api.get(`/api/documents/${id}/party-files`).catch(() => ({ data: [] })),
      ]);

      setWantsDigital(!!prefRes.data?.wants_digital_submission);
      setDraftList(draftsRes.data || []);
      setAnnexureList(annexRes.data || []);
      setPartyList(partiesRes.data || []);
    } catch {
      setError("Could not load digital submission details.");
    }
  }

  useEffect(() => {
    loadAll();
    /* eslint-disable-next-line */
  }, [id]);

  async function handlePreferenceChange(value) {
    setWantsDigital(value);
    setError("");
    setSuccessMsg("");
    try {
      await api.put(`/api/documents/${id}/digital-submission-preference`, {
        wants_digital_submission: value,
      });
    } catch {
      setError("Could not update digital submission preference.");
    }
  }

  async function handleUploadDraft(e) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    if (!draftFile) {
      setError(t("validation:fileRequired"));
      return;
    }
    const draftFileError = validatePdfFile(draftFile);
    if (draftFileError) { setError(t(draftFileError)); return; }

    const formData = new FormData();
    formData.append("category", draftCategory);
    formData.append("file", draftFile);

    setUploadingDraft(true);
    try {
      await api.post(`/api/documents/${id}/draft-files`, formData);
      setDraftFile(null);
      setSuccessMsg("Draft document uploaded successfully.");
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to upload draft document.");
    } finally {
      setUploadingDraft(false);
    }
  }

  async function handleDeleteDraft(fileId) {
    try {
      await api.delete(`/api/documents/${id}/draft-files/${fileId}`);
      await loadAll();
    } catch {
      setError("Could not delete draft document.");
    }
  }

  async function handleUploadAnnexure(e) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    if (!annexureFile) {
      setError(t("validation:fileRequired"));
      return;
    }
    const annexureFileError = validatePdfFile(annexureFile);
    if (annexureFileError) { setError(t(annexureFileError)); return; }

    const formData = new FormData();
    formData.append("title", annexureTitle);
    if (annexureTitleOther) formData.append("title_other", annexureTitleOther);
    if (poaName) formData.append("poa_name", poaName);
    if (poaPrinciple) formData.append("poa_principle", poaPrinciple);
    formData.append("file", annexureFile);

    setUploadingAnnexure(true);
    try {
      await api.post(`/api/documents/${id}/annexure-files`, formData);
      setAnnexureFile(null);
      setAnnexureTitleOther("");
      setPoaName("");
      setPoaPrinciple("");
      setSuccessMsg("Annexure document uploaded successfully.");
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to upload annexure.");
    } finally {
      setUploadingAnnexure(false);
    }
  }

  async function handleDeleteAnnexure(fileId) {
    try {
      await api.delete(`/api/documents/${id}/annexure-files/${fileId}`);
      await loadAll();
    } catch {
      setError("Could not delete annexure document.");
    }
  }

  async function handleUploadIdentity(partyId) {
    setError("");
    setSuccessMsg("");
    if (!identityFile) {
      setError(t("validation:fileRequired"));
      return;
    }
    const identityFileError = validatePdfFile(identityFile);
    if (identityFileError) { setError(t(identityFileError)); return; }
    const formData = new FormData();
    formData.append("proof_type", identityProofType);
    formData.append("file", identityFile);

    setUploadingPartyDoc(true);
    try {
      await api.post(`/api/parties/${partyId}/identity-file`, formData);
      setIdentityFile(null);
      setSuccessMsg("Party identity file uploaded.");
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to upload identity file.");
    } finally {
      setUploadingPartyDoc(false);
    }
  }

  async function handleUploadPan(partyId) {
    setError("");
    setSuccessMsg("");
    if (!panFile) {
      setError(t("validation:fileRequired"));
      return;
    }
    const panFileError = validatePdfFile(panFile);
    if (panFileError) { setError(t(panFileError)); return; }
    const formData = new FormData();
    formData.append("file", panFile);

    setUploadingPartyDoc(true);
    try {
      await api.post(`/api/parties/${partyId}/pan-file`, formData);
      setPanFile(null);
      setSuccessMsg("Party PAN / Form-16 file uploaded.");
      await loadAll();
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to upload PAN file.");
    } finally {
      setUploadingPartyDoc(false);
    }
  }

  async function handleDeletePartyFile(fileId) {
    try {
      await api.delete(`/api/party-files/${fileId}`);
      await loadAll();
    } catch {
      setError("Could not delete party file.");
    }
  }

  async function handleSubmitPackage() {
    setError("");
    setSuccessMsg("");
    try {
      const { data } = await api.post(`/api/documents/${id}/submit-digital-package`);
      setSubmitted(true);
      setSuccessMsg(data.message || "Digital document package submitted successfully.");
    } catch (err) {
      setError(err?.response?.data?.detail || "Digital document submission failed.");
    }
  }

  function handleNextClick() {
    if (!wantsDigital) {
      navigate(`/entries/${id}/report`);
      return;
    }
    if (!submitted) {
      // Check if compulsory draft docs exist
      const catCount = new Set(draftList.map((d) => d.category)).size;
      if (catCount < 2) {
        setError(t("validation:digitalDraftsRequired"));
        return;
      }
    }
    navigate(`/entries/${id}/report`);
  }

  return (
    <div className="page-shell">
      <HeaderSarita />
      <div className="dds-container">
        <div className="dds-title">Digital Document Submission</div>

        {error && <div className="banner banner-error" style={{ marginBottom: "15px" }}>{error}</div>}
        {successMsg && (
          <div className="banner banner-success" style={{ marginBottom: "15px", backgroundColor: "#c6f6d5", color: "#22543d", padding: "10px", borderRadius: "4px" }}>
            {successMsg}
          </div>
        )}

        {/* Landing Question Card */}
        <div className="dds-preference-card">
          <div className="dds-question-text">
            Do you want to avail the Online submission of Digital document facility?
          </div>
          <div className="dds-radio-row">
            <label className="dds-radio-label">
              <input
                type="radio"
                name="wantsDigital"
                checked={wantsDigital === true}
                onChange={() => handlePreferenceChange(true)}
              />
              YES
            </label>
            <label className="dds-radio-label">
              <input
                type="radio"
                name="wantsDigital"
                checked={wantsDigital === false}
                onChange={() => handlePreferenceChange(false)}
              />
              NO / Cancel
            </label>
            <button type="button" className="btn btn-green" onClick={() => setShowInfoModal(true)}>Click Here</button>
          </div>
          <div className="dds-office-notice">
            Note: At present this facility is Available for: SR MUMBAI, SR ANDHARI 2, SR BORIWALI 2, SR KURLA 2 only.
          </div>
        </div>

        {/* Form Sections (Only visible if YES path selected) */}
        {wantsDigital && (
          <>
            <div className="dds-warning-banner">
              Execution date mentioned in uploaded document shall be 5 days ahead of submission date.
            </div>

            {/* Section 1: Draft & Execution Page */}
            <div className="dds-section-card">
              <div className="dds-section-title">
                Digital Copy of Draft &amp; Execution Page (Two Documents Are Compulsory)
              </div>
              <form onSubmit={handleUploadDraft}>
                <div className="dds-form-row">
                  <label>Document Category:</label>
                  <select
                    className="dds-select"
                    value={draftCategory}
                    onChange={(e) => setDraftCategory(e.target.value)}
                  >
                    {DRAFT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setDraftFile(e.target.files[0] || null)}
                  />

                  <button
                    type="submit"
                    className="btn-upload"
                    disabled={uploadingDraft}
                  >
                    {uploadingDraft ? "Uploading..." : "Upload"}
                  </button>
                </div>
              </form>

              {/* Draft Results Table */}
              <table className="dds-table">
                <thead>
                  <tr>
                    <th>Sr. No</th>
                    <th>Tittle</th>
                    <th>View</th>
                    <th>Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {draftList.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", color: "#718096" }}>
                        No draft documents uploaded yet.
                      </td>
                    </tr>
                  )}
                  {draftList.map((file, idx) => (
                    <tr key={file.id}>
                      <td>{idx + 1}</td>
                      <td>{file.category} ({file.original_filename})</td>
                      <td>
                        <a
                          className="dds-link"
                          href={`/api/documents/${id}/draft-files/${file.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View
                        </a>
                      </td>
                      <td>
                        <span
                          className="dds-link dds-link-delete"
                          onClick={() => handleDeleteDraft(file.id)}
                        >
                          Delete
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Section 2: Scanned Required Annexure (Optional) */}
            <div className="dds-section-card">
              <div className="dds-section-title">
                Scanned Required Annexure (Optional)
              </div>
              <form onSubmit={handleUploadAnnexure}>
                <div className="dds-form-row">
                  <label>Title:</label>
                  <select
                    className="dds-select"
                    value={annexureTitle}
                    onChange={(e) => setAnnexureTitle(e.target.value)}
                  >
                    <option value="Scanned Required Annexure">Scanned Required Annexure</option>
                    <option value="Power of Attorney">Power of Attorney</option>
                    <option value="Other">Other</option>
                  </select>

                  {annexureTitle === "Other" && (
                    <input
                      type="text"
                      className="dds-input"
                      placeholder="Title Other"
                      value={annexureTitleOther}
                      onChange={(e) => setAnnexureTitleOther(e.target.value)}
                    />
                  )}

                  {annexureTitle === "Power of Attorney" && (
                    <>
                      <input
                        type="text"
                        className="dds-input"
                        placeholder="POA Name"
                        value={poaName}
                        onChange={(e) => setPoaName(e.target.value)}
                      />
                      <input
                        type="text"
                        className="dds-input"
                        placeholder="POA Principle"
                        value={poaPrinciple}
                        onChange={(e) => setPoaPrinciple(e.target.value)}
                      />
                    </>
                  )}

                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => setAnnexureFile(e.target.files[0] || null)}
                  />

                  <button
                    type="submit"
                    className="btn-upload"
                    disabled={uploadingAnnexure}
                  >
                    {uploadingAnnexure ? "Uploading..." : "Upload"}
                  </button>
                </div>
              </form>

              {/* Annexure Table */}
              <table className="dds-table">
                <thead>
                  <tr>
                    <th>Sr. No</th>
                    <th>Tittle</th>
                    <th>Tittle Other</th>
                    <th>POA name</th>
                    <th>POA Principle</th>
                    <th>View</th>
                    <th>Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {annexureList.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", color: "#718096" }}>
                        No annexure files uploaded.
                      </td>
                    </tr>
                  )}
                  {annexureList.map((file, idx) => (
                    <tr key={file.id}>
                      <td>{idx + 1}</td>
                      <td>{file.title} ({file.original_filename})</td>
                      <td>{file.title_other || "—"}</td>
                      <td>{file.poa_name || "—"}</td>
                      <td>{file.poa_principle || "—"}</td>
                      <td>
                        <a
                          className="dds-link"
                          href={`/api/documents/${id}/annexure-files/${file.id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View
                        </a>
                      </td>
                      <td>
                        <span
                          className="dds-link dds-link-delete"
                          onClick={() => handleDeleteAnnexure(file.id)}
                        >
                          Delete
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Section 3: Party Related Documents (Optional) */}
            <div className="dds-section-card">
              <div className="dds-section-title">
                Party Related Documents (Optional)
              </div>
              <table className="dds-table">
                <thead>
                  <tr>
                    <th>Select</th>
                    <th>Party Name</th>
                    <th>Identity Document</th>
                    <th>PAN / Form-16 Document</th>
                  </tr>
                </thead>
                <tbody>
                  {partyList.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", color: "#718096" }}>
                        No parties added in Party Details step yet.
                      </td>
                    </tr>
                  )}
                  {partyList.map((item) => (
                    <tr key={item.party_id}>
                      <td>
                        <span
                          className="dds-link"
                          onClick={() => setSelectedPartyId(item.party_id === selectedPartyId ? null : item.party_id)}
                        >
                          {selectedPartyId === item.party_id ? "Deselect" : "Select"}
                        </span>
                      </td>
                      <td><b>{item.party_name}</b></td>
                      <td>
                        {item.identity_file ? (
                          <>
                            <a className="dds-link" href={`/api/party-files/${item.identity_file.id}`} target="_blank" rel="noreferrer">
                              View ({item.identity_file.proof_type || "Identity"})
                            </a>
                            <span className="dds-link dds-link-delete" onClick={() => handleDeletePartyFile(item.identity_file.id)}>
                              Delete
                            </span>
                          </>
                        ) : (
                          <span style={{ color: "#a0aec0" }}>Not Uploaded</span>
                        )}
                      </td>
                      <td>
                        {item.pan_file ? (
                          <>
                            <a className="dds-link" href={`/api/party-files/${item.pan_file.id}`} target="_blank" rel="noreferrer">
                              View (PAN)
                            </a>
                            <span className="dds-link dds-link-delete" onClick={() => handleDeletePartyFile(item.pan_file.id)}>
                              Delete
                            </span>
                          </>
                        ) : (
                          <span style={{ color: "#a0aec0" }}>Not Uploaded</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Per Party Upload Drawer */}
              {selectedPartyId && (
                <div className="dds-party-drawer">
                  <div style={{ fontWeight: "bold", marginBottom: "10px" }}>
                    Upload Documents for Party: {partyList.find((p) => p.party_id === selectedPartyId)?.party_name}
                  </div>
                  <div className="dds-form-row">
                    <label>Identity Proof:</label>
                    <select
                      className="dds-select"
                      value={identityProofType}
                      onChange={(e) => setIdentityProofType(e.target.value)}
                    >
                      {ID_PROOFS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    <input type="file" onChange={(e) => setIdentityFile(e.target.files[0] || null)} />
                    <button
                      type="button"
                      className="btn-upload"
                      onClick={() => handleUploadIdentity(selectedPartyId)}
                      disabled={uploadingPartyDoc}
                    >
                      Upload Identity
                    </button>
                  </div>

                  <div className="dds-form-row" style={{ marginTop: "10px" }}>
                    <label>Copy of PAN card / Form-16:</label>
                    <input type="file" onChange={(e) => setPanFile(e.target.files[0] || null)} />
                    <button
                      type="button"
                      className="btn-upload"
                      onClick={() => handleUploadPan(selectedPartyId)}
                      disabled={uploadingPartyDoc}
                    >
                      Upload PAN
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Action Bar */}
        <div className="dds-action-bar">
          <button
            type="button"
            className="btn-nav-back"
            onClick={() => navigate(`/entries/${id}/identifications`)}
          >
            Back / मागे
          </button>

          {wantsDigital && (
            <>
              <button
                type="button"
                className="btn-witness-nav"
                onClick={() => navigate(`/entries/${id}/identifications`)}
              >
                Add Witnesses Before Submit.
              </button>

              <button
                type="button"
                className="btn-submit-pkg"
                onClick={handleSubmitPackage}
                disabled={submitted}
              >
                {submitted ? "Submitted ✔" : "Submit"}
              </button>
            </>
          )}

          <button
            type="button"
            className="btn-nav-next"
            onClick={handleNextClick}
          >
            Next / पुढे
          </button>
        </div>
      </div>
      <Footer />

      {/* Info Modal */}
      {showInfoModal && (
        <div className="dds-modal-backdrop" onClick={() => setShowInfoModal(false)}>
          <div className="dds-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "600px", margin: "40px auto", backgroundColor: "#fff", padding: "20px", borderRadius: "5px", boxShadow: "0 2px 10px rgba(0,0,0,0.2)", height: "80vh", overflowY: "auto" }}>
            <button
              type="button"
              className="dds-modal-close"
              onClick={() => setShowInfoModal(false)}
              aria-label="Close"
              style={{ float: "right", background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer" }}
            >
              &#10006;
            </button>
            <h2 style={{ color: "#2E8B57", borderBottom: "1px solid #ccc", paddingBottom: "10px" }}>Draft Document Details</h2>
            
            <h4 style={{ color: "red", marginTop: "15px" }}>Online submission of Digital Document</h4>
            
            <div style={{ fontSize: "0.9rem", lineHeight: "1.6" }}>
              <p><strong>What is this?</strong></p>
              <ul style={{ paddingLeft: "20px" }}>
                <li>You can upload the draft of document to be registered.</li>
                <li>This facility will save the time for scrutiny of document at Sub Registrar Office and also the time for scanning of document.</li>
                <li>At present, available for non-executed document only. Shall be provided soon for executed document.</li>
                <li>At Present this facility is available for SR Mumbai-2, SR Andheri-2, SR Borivali-2 and SR Kurla-2 only. Shall be provided for other Offices soon.</li>
              </ul>

              <p><strong>Work Flow :</strong></p>
              
              <p><strong>1. Preparation:</strong><br />
              &bull; Prepare your draft, don't execute (don't sign).<br />
              &bull; Put the future date of execution, not earlier than 3 days from the date of online submission.<br />
              &bull; Separate out the page/s on which execution to be done (i.e. the execution page/s).<br />
              &bull; Convert the word file of the draft document without execution page/s in to pdf format. (No scanned file).<br />
              &bull; Similarly convert the word file of the execution page/s in to pdf format. (No scanned file)<br />
              &bull; If you have the scanner, scan the required annexure including ID proofs, PAN etc. and save it in separate pdf files.</p>

              <p><strong>2. Submission:</strong><br />
              &bull; Attach the pdf files of Draft and execution page at relevant place and submit.<br />
              &bull; It is optional to attach at relevant place and submit the required annexure/s.</p>

              <p><strong>3. Scrutiny by Sub Registrar:</strong><br />
              &bull; The Sub Registrar will check the draft and communicate you whether the document is qualified for registration or not.<br />
              &bull; You can check the status in the PDE Module by using your user id and password.<br />
              &bull; If qualified, you can visit the Sub Registrar's office on scheduled date of execution (i.e. Date of execution mentioned in the draft).<br />
              &bull; If queried by Sub Registrar, edit the draft accordingly and upload the modified file.</p>

              <p><strong>4. Activity at Sub Registrar office:</strong><br />
              &bull; All the executants (i.e. the executing parties to the document) and the witnesses have to be present simultaneously in Sub Registrar office on the date of execution.<br />
              &bull; No need of document to bring, only the required annexures and photos of Parties will be required.<br />
              &bull; Sub Registrar will take printout of the uploaded document and handover to the party.<br />
              &bull; All parties will execute (sign) the document and witnesses will sign. Shall also affix the photos and Thumb impression at relevant place.</p>

              <p><strong>5. Registration:</strong><br />
              &bull; The presentation, Admission, Identification and Registration will take place as usual.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
