import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios.js";
import HeaderSarita from "../components/HeaderSarita.jsx";
import Footer from "../components/Footer.jsx";
import "./TokenInformation.css";

export default function TokenInformation() {
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

  async function loadTokens(params = {}) {
    try {
      const { data } = await api.get("/api/tokens", { params });
      setTokens(data);
      setShowTable(true);
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not load tokens.");
    }
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

  return (
    <div className="page-shell">
      <HeaderSarita />
      <div className="page-body tok-body">
        <div className="tok-topline">
          <Link to="/dashboard" className="tok-back">&larr; Back</Link>
          <a href="#" onClick={(e) => { e.preventDefault(); handleLogout(); }}>Logout &#128274;</a>
        </div>
        <h1 className="tok-title">Token Information</h1>
        <div className="tok-user">User Name : {user?.username}</div>

        {error && <div className="banner banner-error">{error}</div>}

        <div className="tok-grid">
          <div>
            <h2 className="tok-col-title">Old Token Information</h2>
            <button className="btn btn-blue tok-show-btn" onClick={() => loadTokens()}>Show all token information</button>
            <div className="tok-filter-hint">Filter your search below &darr;</div>

            <div className="tok-form-row">
              <label>Token Start Date :</label>
              <input type="date" value={filters.start_date} onChange={(e) => setFilters((f) => ({ ...f, start_date: e.target.value }))} />
            </div>
            <div className="tok-form-row">
              <label>Token End Date :</label>
              <input type="date" value={filters.end_date} onChange={(e) => setFilters((f) => ({ ...f, end_date: e.target.value }))} />
            </div>
            <div className="tok-form-row">
              <label>Presenter Name :</label>
              <input value={filters.presenter_name} onChange={(e) => setFilters((f) => ({ ...f, presenter_name: e.target.value }))} />
            </div>
            <div className="tok-filter-actions">
              <button className="btn btn-blue" onClick={applyFilters}>Apply filters</button>
              <button className="btn btn-red" onClick={clearFilters}>Clear</button>
            </div>

            {showTable && (
              <table className="tok-table">
                <thead>
                  <tr><th>Token #</th><th>Presenter</th><th>Status</th><th>Created</th></tr>
                </thead>
                <tbody>
                  {tokens.length === 0 && (
                    <tr><td colSpan={4} style={{ color: "#777" }}>No tokens yet.</td></tr>
                  )}
                  {tokens.map((t) => (
                    <tr key={t.id}>
                      <td className="mono">{t.token_number}</td>
                      <td>{t.presenter_name || "\u2014"}</td>
                      <td><span className={`status-pill status-${t.status.toLowerCase()}`}>{t.status}</span></td>
                      <td>{new Date(t.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div>
            <h2 className="tok-col-title">New Token Entry</h2>
            <form onSubmit={startToken}>
              <div className="tok-form-row">
                <label>Select Language :</label>
                <select value={newToken.language} onChange={(e) => setNewToken((f) => ({ ...f, language: e.target.value }))}>
                  <option value="\u092e\u0930\u093e\u0920\u0940">\u092e\u0930\u093e\u0920\u0940</option>
                  <option value="English">English</option>
                </select>
              </div>
              <div className="tok-form-row">
                <label>Select District :</label>
                <select value={newToken.district_id} onChange={(e) => setNewToken((f) => ({ ...f, district_id: e.target.value, office_id: "" }))}>
                  <option value="">--Select District--</option>
                  {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="tok-form-row">
                <label>Choose SRO :</label>
                <select value={newToken.office_id} onChange={(e) => setNewToken((f) => ({ ...f, office_id: e.target.value }))} disabled={!newToken.district_id}>
                  <option value="">--Select SRO--</option>
                  {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="tok-new-actions">
                <button className="btn btn-blue" type="submit">Start</button>
                <button type="button" className="btn btn-red" onClick={() => setNewToken({ language: "\u092e\u0930\u093e\u0920\u0940", district_id: "", office_id: "" })}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <Footer copyright="Copyright \u00A9 (2026) DakhalNama 1.9, National Informatics Centre, Pune" />
    </div>
  );
}
