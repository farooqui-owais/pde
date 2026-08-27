import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axios.js";
import HeaderSarita from "../components/HeaderSarita.jsx";
import Footer from "../components/Footer.jsx";
import "./EntrySteps.css";

export default function Confirmation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // Re-post is safe/idempotent server-side (just re-marks SUBMITTED and
    // returns the same office list) in case the user lands here directly.
    api.post(`/api/documents/${id}/complete`)
      .then((r) => setData(r.data))
      .catch((err) => setError(err?.response?.data?.detail || "Could not load confirmation."));
  }, [id]);

  return (
    <div className="page-shell">
      <HeaderSarita />
      <div className="page-body entry-body">
        <h1 className="entry-title">Confirmation</h1>
        {error && <div className="banner banner-error">{error}</div>}

        {data && (
          <div className="confirm-box">
            <div className="confirm-message">{data.message}</div>
            <div className="confirm-note">Please Remember Data Entry Number:</div>
            <div className="confirm-token">{data.token_number}</div>
            <div className="confirm-note">Also remember your password for changes in this existing data entry.</div>

            <div className="confirm-note">You can go to any of the following Concurrent SRO Offices:</div>
            <table className="confirm-table">
              <thead><tr><th>Sr.No</th><th>SRO Office Name</th></tr></thead>
              <tbody>
                {data.concurrent_offices.length === 0 && (
                  <tr><td colSpan={2} style={{ color: "#777" }}>No offices configured for this district yet.</td></tr>
                )}
                {data.concurrent_offices.map((o, i) => (
                  <tr key={o.id}><td>{i + 1}</td><td>{o.name}</td></tr>
                ))}
              </tbody>
            </table>

            <button type="button" className="btn btn-green" onClick={() => navigate("/tokens")}>Complete</button>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
