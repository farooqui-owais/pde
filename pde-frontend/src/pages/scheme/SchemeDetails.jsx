import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import HeaderSarita from "../../components/HeaderSarita";
import Footer from "../../components/Footer";
import schemeApi from "../../api/schemeApi";
import "./SchemeDetails.css";

export default function SchemeDetails() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSchemeId, setSelectedSchemeId] = useState(null);

  // Search & Pagination
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // Modify Modal
  const [modifyModalOpen, setModifyModalOpen] = useState(false);
  const [schemeToModify, setSchemeToModify] = useState(null);
  const [modifying, setModifying] = useState(false);

  // New Scheme / Project Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [newProjectMode, setNewProjectMode] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [schemeName, setSchemeName] = useState("");
  const [article, setArticle] = useState("Conveyance");
  const [documentTitle, setDocumentTitle] = useState("Sale Deed / खरेदीखत");
  const [mahaRera, setMahaRera] = useState("");
  const [projectArea, setProjectArea] = useState("");
  const [location, setLocation] = useState("");
  const [district, setDistrict] = useState("Pune");
  const [taluka, setTaluka] = useState("Haveli");
  const [village, setVillage] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchSchemes = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await schemeApi.getSchemes({
        search,
        status: statusFilter || undefined,
        page,
        page_size: pageSize,
      });
      setSchemes(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to load schemes.");
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await schemeApi.getProjects();
      setProjects(res.data || []);
      if (res.data.length > 0 && !selectedProjectId) {
        setSelectedProjectId(res.data[0].id);
      }
    } catch (err) {
      console.error("Failed to load projects", err);
    }
  };

  useEffect(() => {
    fetchSchemes();
  }, [page, pageSize, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchSchemes();
  };

  const handleOpenModifyModal = (scheme) => {
    setSchemeToModify(scheme);
    setModifyModalOpen(true);
  };

  const handleConfirmModify = async () => {
    if (!schemeToModify) return;
    setModifying(true);
    try {
      await schemeApi.modifyScheme(schemeToModify.id);
      setModifyModalOpen(false);
      navigate(`/schemes/${schemeToModify.id}/steps/1?mode=modify`);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Could not switch scheme to modify mode.");
    } finally {
      setModifying(false);
    }
  };

  const handleOpenCreateModal = () => {
    fetchProjects();
    setCreateModalOpen(true);
  };

  const handleCreateSchemeSubmit = async (e) => {
    e.preventDefault();
    if (!schemeName) {
      alert("Please enter a Scheme Name");
      return;
    }
    setCreating(true);
    try {
      let finalProjectId = selectedProjectId;

      if (newProjectMode || !finalProjectId) {
        if (!projectName) {
          alert("Please enter a Project Name");
          setCreating(false);
          return;
        }
        const projRes = await schemeApi.createProject({
          project_name: projectName,
          district,
          taluka,
          village,
          location,
        });
        finalProjectId = projRes.data.id;
      }

      const schemeRes = await schemeApi.createScheme({
        project_id: finalProjectId,
        scheme_name: schemeName,
        article,
        document_title: documentTitle,
        maha_rera_number: mahaRera,
        project_area: projectArea ? parseFloat(projectArea) : null,
      });

      setCreateModalOpen(false);
      setSchemeName("");
      setProjectName("");
      fetchSchemes();
      navigate(`/schemes/${schemeRes.data.id}/steps/1`);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to create scheme");
    } finally {
      setCreating(false);
    }
  };

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="scheme-page-wrapper">
      <HeaderSarita />
      <div className="scheme-container">
        <div className="scheme-header-bar">
          <div>
            <h1 className="scheme-title">Scheme Details / योजना तपशील</h1>
            <p className="scheme-subtitle">
              Manage builder & developer property schemes, document templates, and seller entries.
            </p>
          </div>
          <div className="scheme-header-actions">
            <button className="btn btn-secondary" onClick={() => navigate("/dashboard")}>
              ← Back to Dashboard
            </button>
            <button className="btn btn-primary" onClick={handleOpenCreateModal}>
              + Create New Scheme
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="scheme-toolbar">
          <form className="scheme-search-form" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              className="scheme-input"
              placeholder="Search by Scheme Name, Form ID, or Project..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm">
              Search
            </button>
            {search && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                  setTimeout(fetchSchemes, 50);
                }}
              >
                Clear
              </button>
            )}
          </form>

          <div className="scheme-filters">
            <label className="scheme-filter-label">
              Status:
              <select
                className="scheme-select"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>

            <label className="scheme-filter-label">
              Rows:
              <select
                className="scheme-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </label>
          </div>
        </div>

        {/* Error Alert */}
        {error && <div className="scheme-error-box">{error}</div>}

        {/* Table Content */}
        <div className="scheme-table-container">
          <table className="scheme-table">
            <thead>
              <tr>
                <th style={{ width: "40px" }}>Select</th>
                <th>Form ID / Scheme No.</th>
                <th>Project Name</th>
                <th>Scheme Name</th>
                <th>Article / Document</th>
                <th>Status</th>
                <th>JDR Remark</th>
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="scheme-loading-cell">
                    Loading scheme records...
                  </td>
                </tr>
              ) : schemes.length === 0 ? (
                <tr>
                  <td colSpan="8" className="scheme-empty-cell">
                    No scheme records found. Click "+ Create New Scheme" to begin.
                  </td>
                </tr>
              ) : (
                schemes.map((s) => (
                  <tr
                    key={s.id}
                    className={selectedSchemeId === s.id ? "scheme-row-selected" : ""}
                    onClick={() => setSelectedSchemeId(s.id)}
                  >
                    <td>
                      <input
                        type="radio"
                        name="selectedScheme"
                        checked={selectedSchemeId === s.id}
                        onChange={() => setSelectedSchemeId(s.id)}
                      />
                    </td>
                    <td className="scheme-code">{s.scheme_number || s.id.substring(0, 8)}</td>
                    <td className="font-semibold">{s.project_name || "—"}</td>
                    <td>{s.scheme_name}</td>
                    <td>
                      <div className="text-sm">{s.article || "—"}</div>
                      <div className="text-xs text-muted">{s.document_title || ""}</div>
                    </td>
                    <td>
                      <span className={`scheme-badge badge-${s.status}`}>{s.status.toUpperCase()}</span>
                    </td>
                    <td className="scheme-remark">{s.jdr_remark || "—"}</td>
                    <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                      <button
                        className="btn btn-secondary btn-xs mr-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/schemes/${s.id}/steps/1`);
                        }}
                      >
                        View / Edit
                      </button>
                      <button
                        className="btn btn-primary btn-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenModifyModal(s);
                        }}
                      >
                        Modify Scheme
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="scheme-pagination-bar">
          <span className="scheme-page-info">
            Showing {schemes.length > 0 ? (page - 1) * pageSize + 1 : 0} to{" "}
            {Math.min(page * pageSize, total)} of {total} entries
          </span>
          <div className="scheme-page-buttons">
            <button
              className="btn btn-secondary btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span className="scheme-current-page">
              Page {page} of {totalPages}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modify Confirmation Modal */}
      {modifyModalOpen && (
        <div className="scheme-modal-backdrop">
          <div className="scheme-modal">
            <div className="scheme-modal-header">
              <h3>Modify Scheme Confirmation</h3>
              <button className="scheme-modal-close" onClick={() => setModifyModalOpen(false)}>
                &times;
              </button>
            </div>
            <div className="scheme-modal-body">
              <p>
                Are you sure you want to modify Scheme: <strong>{schemeToModify?.scheme_name}</strong>?
              </p>
              <p className="text-sm text-muted mt-2">
                This action will open the 5-step Scheme workflow (Seller Entry, Scheme Identifier, Document Upload,
                Template Builder, and Submission) in modification mode.
              </p>
            </div>
            <div className="scheme-modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setModifyModalOpen(false)}
                disabled={modifying}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmModify}
                disabled={modifying}
              >
                {modifying ? "Opening..." : "Yes, Modify Scheme"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Scheme Modal */}
      {createModalOpen && (
        <div className="scheme-modal-backdrop">
          <div className="scheme-modal scheme-modal-lg">
            <div className="scheme-modal-header">
              <h3>Create New Scheme / नवीन योजना</h3>
              <button className="scheme-modal-close" onClick={() => setCreateModalOpen(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateSchemeSubmit}>
              <div className="scheme-modal-body">
                <div className="scheme-form-section">
                  <div className="flex justify-between items-center mb-2">
                    <label className="font-bold">Project Selection</label>
                    <button
                      type="button"
                      className="btn btn-link text-xs"
                      onClick={() => setNewProjectMode(!newProjectMode)}
                    >
                      {newProjectMode ? "Select Existing Project" : "+ Create New Project"}
                    </button>
                  </div>

                  {!newProjectMode && projects.length > 0 ? (
                    <div className="form-group">
                      <label>Existing Project *</label>
                      <select
                        className="scheme-input"
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        required
                      >
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.project_name} ({p.district || "Maharashtra"})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="form-grid-2">
                      <div className="form-group">
                        <label>New Project Name *</label>
                        <input
                          type="text"
                          className="scheme-input"
                          placeholder="e.g. Royal Meadows Residency"
                          value={projectName}
                          onChange={(e) => setProjectName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>District</label>
                        <input
                          type="text"
                          className="scheme-input"
                          value={district}
                          onChange={(e) => setDistrict(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="scheme-form-section mt-4">
                  <h4 className="font-bold mb-2">Scheme Details</h4>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label>Scheme Name *</label>
                      <input
                        type="text"
                        className="scheme-input"
                        placeholder="e.g. Phase 1 - Wing A"
                        value={schemeName}
                        onChange={(e) => setSchemeName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>MahaRERA Registration Number</label>
                      <input
                        type="text"
                        className="scheme-input"
                        placeholder="e.g. P52100012345"
                        value={mahaRera}
                        onChange={(e) => setMahaRera(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Article Type</label>
                      <input
                        type="text"
                        className="scheme-input"
                        value={article}
                        onChange={(e) => setArticle(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Document Title</label>
                      <input
                        type="text"
                        className="scheme-input"
                        value={documentTitle}
                        onChange={(e) => setDocumentTitle(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Project Area (sq.ft)</label>
                      <input
                        type="number"
                        className="scheme-input"
                        placeholder="e.g. 50000"
                        value={projectArea}
                        onChange={(e) => setProjectArea(e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>Location / Taluka</label>
                      <input
                        type="text"
                        className="scheme-input"
                        placeholder="e.g. Haveli, Pune"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="scheme-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? "Creating..." : "Save & Proceed to Steps →"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
