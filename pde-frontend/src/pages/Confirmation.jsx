import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios.js";
import HeaderSarita from "../components/HeaderSarita.jsx";
import Footer from "../components/Footer.jsx";
import "./EntrySteps.css";

export default function Confirmation() {
  const { t } = useTranslation(["pages", "common"]);
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.post(`/api/documents/${id}/complete`)
      .then((r) => setData(r.data))
      .catch((err) => setError(err?.response?.data?.detail || t("confirmation.couldNotLoad")));
  }, [id]);

  return (
    <div className="page-shell">
      <HeaderSarita />
      <div className="page-body entry-body">
        <h1 className="entry-title">{t("confirmation.title")}</h1>
        {error && <div className="banner banner-error">{error}</div>}

        {data && (
          <div className="confirm-box">
            <div className="confirm-message">{data.message}</div>
            <div className="confirm-note">{t("confirmation.rememberDen")}</div>
            <div className="confirm-token">{data.token_number}</div>
            <div className="confirm-note">{t("confirmation.rememberPassword")}</div>

            <div className="confirm-note">{t("confirmation.concurrent")}</div>
            <table className="confirm-table">
              <thead><tr><th>{t("confirmation.srNo")}</th><th>{t("confirmation.sroOfficeName")}</th></tr></thead>
              <tbody>
                {data.concurrent_offices.length === 0 && (
                  <tr><td colSpan={2} style={{ color: "#777" }}>{t("confirmation.noOffices")}</td></tr>
                )}
                {data.concurrent_offices.map((o, i) => (
                  <tr key={o.id}><td>{i + 1}</td><td>{o.name}</td></tr>
                ))}
              </tbody>
            </table>

            <button type="button" className="btn btn-green" onClick={() => navigate("/tokens")}>{t("confirmation.complete")}</button>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
