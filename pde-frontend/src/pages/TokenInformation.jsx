import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios.js";
import HeaderSarita from "../components/HeaderSarita.jsx";
import Footer from "../components/Footer.jsx";
import "./TokenInformation.css";

const LANGUAGE_OPTIONS = ["\u092e\u0930\u093e\u0920\u0940", "English"];

export default function TokenInformation() {
  const { t } = useTranslation(["pages", "common"]);
  const navigate = useNavigate();
  const userRaw = localStorage.getItem("dn_user");
  const user = userRaw ? JSON.parse(userRaw) : null;

  const [tokens, setTokens] = useState([]);
  const [showTable, setShowTable] = useState(false);
  const [districts, setDistricts] = useState([]);
  const [offices, setOffices] = useState([]);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState({ start_date: "", end_date: "", presenter_name: "" });
  const [newToken, setNewToken] = useState({ language: "\u092e\u0930\u093e\u0920\u0940", district_id: "", office_id: "" });

  // View Token Details modal
  const [viewToken, setViewToken] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState("");

  // Edit Token Details modal
  const [editToken, setEditToken] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editOffices, setEditOffices] = useState([]);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  async function loadTokens(params = {}) {
    try {
      const { data } = await api.get("/api/tokens", { params });
      setTokens(data);
      setShowTable(true);
    } catch (err) {
      setError(err?.response?.data?.detail || t("token.couldNotLoadTokens"));
    }
  }

  /** Refresh a single row in place after edit, without re-running the
   *  current filters (which may no longer match after presenter_name etc.
   *  changed). */
  function patchTokenRow(updated) {
    setTokens((rows) => rows.map((r) => (r.id === updated.id ? updated : r)));
  }

  useEffect(() => {
    api.get("/api/reference/districts").then((r) => setDistricts(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (newToken.district_id) {
      api.get("/api/reference/offices", { params: { district_id: newToken.district_id } })
        .then((r) => setOffices(r.data)).catch(() => setOffices([]));
    } else {
      setOffices([]);
    }
  }, [newToken.district_id]);

  function applyFilters() {
    const params = {};
    if (filters.start_date) params.start_date = filters.start_date;
    if (filters.end_date) params.end_date = filters.end_date;
    if (filters.presenter_name) params.presenter_name = filters.presenter_name;
    loadTokens(params);
  }

  function clearFilters() {
    setFilters({ start_date: "", end_date: "", presenter_name: "" });
    setShowTable(false);
  }

  async function startToken(e) {
    e.preventDefault();
    setError("");
    try {
      const payload = {
        language: newToken.language,
        district_id: newToken.district_id ? Number(newToken.district_id) : null,
        office_id: newToken.office_id ? Number(newToken.office_id) : null,
      };
      const { data } = await api.post("/api/tokens", payload);
      navigate("/entries/new", { state: { tokenId: data.id, tokenNumber: data.token_number } });
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not create a token.");
    }
  }

  function handleLogout() {
    localStorage.removeItem("dn_token");
    localStorage.removeItem("dn_user");
    navigate("/login");
  }

  // ---- View Token Details ----
  async function openView(tokenRow) {
    setViewToken(tokenRow); // show modal immediately with what we already have
    setViewError("");
    setViewLoading(true);
    try {
      const { data } = await api.get(`/api/tokens/${tokenRow.id}`);
      setViewToken(data);
      patchTokenRow(data);
    } catch (err) {
      setViewError(err?.response?.data?.detail || t("token.couldNotLoadToken"));
    } finally {
      setViewLoading(false);
    }
  }

  function closeView() {
    setViewToken(null);
    setViewError("");
  }

  // ---- Edit Token Details ----
  function openEdit(tokenRow) {
    setEditToken(tokenRow);
    setEditForm({
      language: tokenRow.language || "\u092e\u0930\u093e\u0920\u0940",
      district_id: tokenRow.district_id || "",
      office_id: tokenRow.office_id || "",
      presenter_name: tokenRow.presenter_name || "",
    });
    setEditError("");
    setEditSuccess("");
    if (tokenRow.district_id) {
      api.get("/api/reference/offices", { params: { district_id: tokenRow.district_id } })
        .then((r) => setEditOffices(r.data)).catch(() => setEditOffices([]));
    } else {
      setEditOffices([]);
    }
  }

  function closeEdit() {
    setEditToken(null);
    setEditForm(null);
    setEditError("");
    setEditSuccess("");
  }

  function updateEditField(field, value) {
    setEditForm((f) => ({ ...f, [field]: value }));
    if (field === "district_id") {
      setEditForm((f) => ({ ...f, office_id: "" }));
      if (value) {
        api.get("/api/reference/offices", { params: { district_id: value } })
          .then((r) => setEditOffices(r.data)).catch(() => setEditOffices([]));
      } else {
        setEditOffices([]);
      }
    }
  }

  async function handleEditSave(e) {
    e.preventDefault();
    setEditError(""); setEditSuccess("");
    setEditSaving(true);
    try {
      const payload = {
        language: editForm.language,
        district_id: editForm.district_id ? Number(editForm.district_id) : null,
        office_id: editForm.office_id ? Number(editForm.office_id) : null,
        presenter_name: editForm.presenter_name || null,
      };
      const { data } = await api.put(`/api/tokens/${editToken.id}`, payload);
      patchTokenRow(data);
      setEditSuccess(t("token.tokenSaved"));
      setTimeout(closeEdit, 900);
    } catch (err) {
      setEditError(err?.response?.data?.detail || t("token.couldNotSaveToken"));
    } finally {
      setEditSaving(false);
    }
  }

  function fmtDate(value) {
    if (!value) return "\u2014";
    const d = new Date(value);
    return isNaN(d) ? "\u2014" : d.toLocaleDateString("en-GB");
  }

  return (
    <div className="page-shell">
      <HeaderSarita />
      <div className="page-body tok-body">
        <div className="tok-topline">
          <Link to="/dashboard" className="tok-back">&larr; {t("common:back")}</Link>
          <a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }}>{t("common:logout")} &#128274;</a>
        </div>
        <h1 className="tok-title">{t("token.title")}</h1>
        <div className="tok-user">{t("token.userLabel")} {user?.username}</div>

        {error && <div className="banner banner-error">{error}</div>}

        <div className="tok-grid">
          <div>
            <h2 className="tok-col-title">{t("token.oldTokenInfo")}</h2>
            <button className="btn btn-blue tok-show-btn" onClick={() => loadTokens()}>{t("token.showAllTokenInfo")}</button>
            <div className="tok-filter-hint">{t("token.filterHint")}</div>

            <div className="tok-form-row">
              <label>{t("token.startDate")}</label>
              <input type="date" value={filters.start_date} onChange={(e) => setFilters((f) => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div className="tok-form-row">
              <label>{t("token.endDate")}</label>
              <input type="date" value={filters.end_date} onChange={(e) => setFilters((f) => ({ ...f, end_date: e.target.value }))} />
            </div>
            <div className="tok-form-row">
              <label>{t("token.presenterName")}</label>
              <input value={filters.presenter_name} onChange={(e) => setFilters((f) => ({ ...f, presenter_name: e.target.value }))} />
            </div>
            <div className="tok-filter-actions">
              <button className="btn btn-blue" onClick={applyFilters}>{t("token.applyFilters")}</button>
              <button className="btn btn-red" onClick={clearFilters}>{t("token.clear")}</button>
            </div>
          </div>

          <div>
            <h2 className="tok-col-title">{t("token.newTokenEntry")}</h2>
            <form onSubmit={startToken}>
              <div className="tok-form-row">
                <label>{t("token.selectLanguage")}</label>
                <select value={newToken.language} onChange={(e) => setNewToken((f) => ({ ...f, language: e.target.value }))}>
                  {LANGUAGE_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="tok-form-row">
                <label>{t("token.selectDistrict")}</label>
                <select value={newToken.district_id} onChange={(e) => setNewToken((f) => ({ ...f, district_id: e.target.value, office_id: "" }))}>
                  <option value="">{t("token.selectDistrictOption")}</option>
                  {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="tok-form-row">
                <label>{t("token.chooseSRO")}</label>
                <select value={newToken.office_id} onChange={(e) => setNewToken((f) => ({ ...f, office_id: e.target.value }))} disabled={!newToken.district_id}>
                  <option value="">{t("token.selectSROOption")}</option>
                  {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="tok-new-actions">
                <button className="btn btn-blue" type="submit">{t("common:start")}</button>
                <button type="button" className="btn btn-red" onClick={() => setNewToken({ language: "\u092e\u0930\u093e\u0920\u0940", district_id: "", office_id: "" })}>{t("common:cancel")}</button>
              </div>
            </form>
          </div>
        </div>

        {showTable && (
          <div className="tok-table-wrap">
            <table className="tok-table">
              <thead>
                <tr>
                  <th>{t("token.colViewDetails")}</th>
                  <th>{t("token.colEditDetails")}</th>
                  <th className="tok-col-disabled">{t("token.colReimport")}</th>
                  <th className="tok-col-disabled">{t("token.colAddPrevious")}</th>
                  <th className="tok-col-disabled">{t("token.colPreSummary")}</th>
                  <th className="tok-col-disabled">{t("token.colMobileVerification")}</th>
                  <th>{t("token.colToken")}</th>
                  <th>{t("token.colOfficeName")}</th>
                  <th>{t("token.colStartDate")}</th>
                  <th>{t("token.colEndDate")}</th>
                  <th>{t("token.colPresenterName")}</th>
                  <th>{t("token.colPartyCount")}</th>
                  <th>{t("token.colIdentifierCount")}</th>
                  <th>{t("token.colPropertyCount")}</th>
                  <th>{t("token.colLanguage")}</th>
                  <th>{t("token.colIsDraft")}</th>
                  <th>{t("token.colStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {tokens.length === 0 && (
                  <tr><td colSpan={17} style={{ color: "#777" }}>{t("token.noTokens")}</td></tr>
                )}
                {tokens.map((row) => (
                  <tr key={row.id}>
                    <td><button type="button" className="tok-link-btn" onClick={() => openView(row)}>{t("token.view")}</button></td>
                    <td>
                      {row.status === "OPEN"
                        ? <button type="button" className="tok-link-btn" onClick={() => openEdit(row)}>{t("token.edit")}</button>
                        : <span className="tok-disabled-text">{t("token.edit")}</span>}
                    </td>
                    <td className="tok-col-disabled">{t("token.reimport")}</td>
                    <td className="tok-col-disabled">{t("token.select")}</td>
                    <td className="tok-col-disabled">{t("token.print")}</td>
                    <td className="tok-col-disabled">{t("token.mobileVerification")}</td>
                    <td className="mono">{row.token_number}</td>
                    <td>{row.office_name || "\u2014"}</td>
                    <td>{fmtDate(row.created_at)}</td>
                    <td>{row.entry_status === "SUBMITTED" ? fmtDate(row.created_at) : ""}</td>
                    <td>{row.presenter_name || "\u2014"}</td>
                    <td>{row.party_count}</td>
                    <td>{row.identifier_count}</td>
                    <td>{row.property_count}</td>
                    <td>{row.language}</td>
                    <td>{row.is_draft ? t("token.yes") : t("token.no")}</td>
                    <td><span className={`status-pill status-${row.status.toLowerCase()}`}>{row.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Footer copyright="Copyright \u00A9 (2026) National Informatics Centre, Pune" />

      {viewToken && (
        <div className="tok-modal-overlay" onClick={closeView}>
          <div className="tok-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="tok-modal-close" onClick={closeView} aria-label="Close">&#10006;</button>
            <h3 className="tok-modal-title">{t("token.viewModalTitle")}</h3>
            <div className="tok-modal-divider" />
            {viewError && <div className="banner banner-error">{viewError}</div>}
            <dl className="tok-view-list">
              <dt>{t("token.colToken")}</dt><dd className="mono">{viewToken.token_number}</dd>
              <dt>{t("token.colPresenterName")}</dt><dd>{viewToken.presenter_name || "\u2014"}</dd>
              <dt>{t("token.colLanguage")}</dt><dd>{viewToken.language}</dd>
              <dt>{t("token.selectDistrict")}</dt><dd>{viewToken.district_name || "\u2014"}</dd>
              <dt>{t("token.colOfficeName")}</dt><dd>{viewToken.office_name || "\u2014"}</dd>
              <dt>{t("token.colStartDate")}</dt><dd>{fmtDate(viewToken.created_at)}</dd>
              <dt>{t("token.colStatus")}</dt><dd><span className={`status-pill status-${viewToken.status.toLowerCase()}`}>{viewToken.status}</span></dd>
            </dl>
            <div className="tok-modal-divider" />
            <h4 className="tok-view-subhead">{t("token.entrySummary")}</h4>
            {viewToken.entry_id ? (
              <dl className="tok-view-list">
                <dt>{t("token.entryStatus")}</dt><dd>{viewToken.entry_status}</dd>
                <dt>{t("token.colPartyCount")}</dt><dd>{viewToken.party_count}</dd>
                <dt>{t("token.colIdentifierCount")}</dt><dd>{viewToken.identifier_count}</dd>
                <dt>{t("token.colPropertyCount")}</dt><dd>{viewToken.property_count}</dd>
              </dl>
            ) : (
              <div className="tok-filter-hint">{t("token.noEntryYet")}</div>
            )}
            {viewLoading && <div className="tok-filter-hint">{t("common:loading", "Loading\u2026")}</div>}
          </div>
        </div>
      )}

      {editToken && editForm && (
        <div className="tok-modal-overlay" onClick={closeEdit}>
          <div className="tok-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="tok-modal-close" onClick={closeEdit} aria-label="Close">&#10006;</button>
            <h3 className="tok-modal-title">{t("token.editModalTitle")}</h3>
            <div className="tok-modal-divider" />
            {editError && <div className="banner banner-error">{editError}</div>}
            {editSuccess && <div className="banner banner-success">{editSuccess}</div>}
            <form onSubmit={handleEditSave}>
              <div className="tok-modal-row">
                <label>{t("token.presenterName")}</label>
                <input value={editForm.presenter_name} onChange={(e) => updateEditField("presenter_name", e.target.value)} />
              </div>
              <div className="tok-modal-row">
                <label>{t("token.selectLanguage")}</label>
                <select value={editForm.language} onChange={(e) => updateEditField("language", e.target.value)}>
                  {LANGUAGE_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div className="tok-modal-row">
                <label>{t("token.selectDistrict")}</label>
                <select value={editForm.district_id} onChange={(e) => updateEditField("district_id", e.target.value)}>
                  <option value="">{t("token.selectDistrictOption")}</option>
                  {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="tok-modal-row">
                <label>{t("token.chooseSRO")}</label>
                <select value={editForm.office_id} onChange={(e) => updateEditField("office_id", e.target.value)} disabled={!editForm.district_id}>
                  <option value="">{t("token.selectSROOption")}</option>
                  {editOffices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="tok-modal-divider" />
              <div className="tok-modal-actions">
                <button type="submit" className="btn btn-green" disabled={editSaving}>
                  {editSaving ? "\u2026" : t("token.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
