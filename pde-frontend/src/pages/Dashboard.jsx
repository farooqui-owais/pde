import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios.js";
import HeaderTeal from "../components/HeaderTeal.jsx";
import Footer from "../components/Footer.jsx";
import "./Dashboard.css";

const MODULES = [

  { title: "Registration", desc: "Public Data Entry for DakhalNama property registration", color: "var(--green)", to: "/tokens" },
  { title: "Scheme Details", desc: "Builder & Developer Scheme Management, Seller Entries & Deed Templates", color: "var(--blue)", to: "/schemes" },
  { title: "Valuation Rates", desc: "Reference/master Ready Reckoner rates by district, taluka & village (TBD data source)", color: "var(--green)", to: "/valuation-rates" },
  { title: "Marriage", desc: "Public Data Entry for Notice of Intended Marriage", color: "var(--blue)", to: null },
  { title: "eFiling", desc: "Data entry for eFiling (Notice of Intimation)", color: "var(--blue)", to: null },
  { title: "\u0967/\u0967\u0968 Mutations", desc: "Data entry for Land Record 7/12 Mutation", color: "var(--red)", to: null },
  { title: "eRegistration", desc: "Data entry for online registration of Leave and License Agreement for citizen", color: "var(--orange)", to: null },
  { title: "eProperty Card", desc: "Details will be available soon", color: "var(--blue)", to: null },
  { title: "DDM(eMahabhumi)", desc: "Document Delivery Module", color: "var(--orange)", to: null },
  { title: "eMojni", desc: "Land Measurement Module", color: "var(--blue)", to: null },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const userRaw = localStorage.getItem("dn_user");
  const user = userRaw ? JSON.parse(userRaw) : null;

  const [menuOpen, setMenuOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [modalPassword, setModalPassword] = useState("");
  const [modalError, setModalError] = useState("");
  const [modalLoading, setModalLoading] = useState(false);

  function handleLogout() {
    localStorage.removeItem("dn_token");
    localStorage.removeItem("dn_user");
    navigate("/login");
  }

  function openUpdateProfileModal() {
    setMenuOpen(false);
    setModalPassword("");
    setModalError("");
    setShowPasswordModal(true);
  }

  function closeModal() {
    setShowPasswordModal(false);
  }

  async function handleUpdateUserDetails(e) {
    e.preventDefault();
    setModalError("");
    setModalLoading(true);
    try {
      await api.post("/api/auth/verify-password", { password: modalPassword });
      sessionStorage.setItem("dn_profile_unlock", "1");
      setShowPasswordModal(false);
      navigate("/update-profile");
    } catch (err) {
      setModalError(err?.response?.data?.detail || "Incorrect password.");
    } finally {
      setModalLoading(false);
    }
  }

  return (
    <div className="page-shell">
      <HeaderTeal />
      <div className="page-body dash-body">
        <div className="dash-panel">
          <div className="dash-welcome-row">
            <div className="dash-menu">
              <button type="button" className="dash-user-pill" onClick={() => setMenuOpen((o) => !o)}>
                Welcome : {user?.username || "guest"} <span className="dash-caret">&#9662;</span>
              </button>
              {menuOpen && (
                <div className="dash-dropdown">
                  <button type="button" className="dash-dropdown-item" onClick={openUpdateProfileModal}>
                    Update Profile
                  </button>
                  <button type="button" className="dash-dropdown-item" onClick={() => { setMenuOpen(false); navigate("/change-password"); }}>
                    Change Password
                  </button>
                  <div className="dash-dropdown-divider" />
                  <button type="button" className="dash-dropdown-item dash-dropdown-logout" onClick={handleLogout}>
                    Logout &#128274;
                  </button>
                </div>
              )}
            </div>
          </div>
          <h2 className="dash-title">Details</h2>
          <div className="dash-intro">
            Welcome to Public Data Entry. From here, you can either continue with your data entry
            for property registration, or explore other public data entry websites listed below.
          </div>

          <div className="dash-grid">
            {MODULES.map((m) => (
              <div key={m.title} className={"dash-card" + (m.to ? "" : " disabled")}>
                <button
                  className="dash-card-btn"
                  style={{ borderColor: m.color, color: m.color }}
                  onClick={() => m.to && navigate(m.to)}
                  disabled={!m.to}
                >
                  {m.title}
                </button>
                <div className="dash-card-desc">{m.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer copyright="Copyright \u00A9 (2026) National Informatics Centre, Pune" />

      {showPasswordModal && (
        <div className="dash-modal-overlay" onClick={closeModal}>
          <div className="dash-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="dash-modal-close" onClick={closeModal} aria-label="Close">&#10006;</button>
            <h3 className="dash-modal-title">Enter password to update user details.</h3>
            <div className="dash-modal-divider" />
            {modalError && <div className="banner banner-error">{modalError}</div>}
            <form onSubmit={handleUpdateUserDetails}>
              <div className="dash-modal-row">
                <label>Enter Password :</label>
                <input type="password" value={modalPassword} onChange={(e) => setModalPassword(e.target.value)} required autoFocus />
              </div>
              <div className="dash-modal-actions">
                <button type="submit" className="btn btn-blue" disabled={modalLoading}>
                  {modalLoading ? "Checking\u2026" : "Update User Details"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
