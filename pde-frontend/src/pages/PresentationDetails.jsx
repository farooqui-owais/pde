import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios.js";
import HeaderSarita from "../components/HeaderSarita.jsx";
import Footer from "../components/Footer.jsx";
import "./PresentationDetails.css";

function fmtDate(v) {
  if (!v) return "\u2014";
  const d = new Date(v);
  return isNaN(d) ? "\u2014" : d.toLocaleDateString("en-GB");
}

export default function PresentationDetails() {
  const { tokenId } = useParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(null);
  const [entry, setEntry] = useState(null);
  const [payments, setPayments] = useState([]);
  const [properties, setProperties] = useState([]);
  const [parties, setParties] = useState([]);
  const [identifications, setIdentifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const { data: tok } = await api.get(`/api/tokens/${tokenId}`);
        setToken(tok);
        if (tok.entry_id) {
          const [entryRes, propsRes, partiesRes, idRes] = await Promise.all([
            api.get(`/api/documents/${tok.entry_id}`),
            api.get(`/api/documents/${tok.entry_id}/properties`),
            api.get(`/api/documents/${tok.entry_id}/parties`),
            api.get(`/api/documents/${tok.entry_id}/identifications`),
          ]);
          setEntry(entryRes.data);
          setProperties(propsRes.data);
          setParties(partiesRes.data);
          setIdentifications(idRes.data);
          try {
            const { data: pmts } = await api.get(`/api/stamp/payments/${tok.entry_id}`);
            setPayments(pmts);
          } catch {
            setPayments([]);
          }
        }
      } catch (err) {
        setError(err?.response?.data?.detail || "Could not load presentation details");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tokenId]);

  if (loading) return <div className="pd-loading">Loading…</div>;
  if (error) return <div className="pd-error">{error}</div>;

  return (
    <div className="page-shell">
      <HeaderSarita />
      <div className="pd-body">
        <h1 className="pd-main-title">Presentation Details</h1>

        {/* Article Info */}
        {entry && (
          <div className="pd-section">
            <table className="pd-table pd-table-bordered">
              <thead>
                <tr>
                  <th>Article Name</th>
                  <th>Article Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{entry.article_type_name || "\u2014"}</td>
                  <td>{entry.article_type_description || "\u2014"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Presenter Info */}
        {(() => {
          const presenter = parties.find((p) => p.is_presentor) || null;
          const lname = presenter?.surname_mr || presenter?.surname_en || (token?.presenter_name || "").split(" ").slice(-1)[0] || "\u2014";
          const fname = presenter?.first_name_mr || presenter?.first_name_en || (token?.presenter_name || "").split(" ")[0] || "\u2014";
          const mname = presenter?.middle_name_mr || presenter?.middle_name_en || "\u2014";
          return (
            <div className="pd-section">
              <table className="pd-table pd-table-bordered">
                <thead>
                  <tr>
                    <th>Last Name</th>
                    <th>First Name</th>
                    <th>Middle Name</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{lname}</td>
                    <td>{fname}</td>
                    <td>{mname}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })()}

        {/* Presentation Step 1 Summary */}
        {entry && (
          <div className="pd-section">
            <table className="pd-table pd-table-bordered">
              <thead>
                <tr>
                  <th>Presenter Type</th>
                  <th>No</th>
                  <th>Valuation Text</th>
                  <th>novaluation_reason</th>
                  <th>Market Value</th>
                  <th>Consideration Amt</th>
                  <th>Stamp Duty Calc</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{entry.presenter_type || "\u2014"}</td>
                  <td>1</td>
                  <td>{entry.valuation_text || "\u2014"}</td>
                  <td>{entry.no_valuation_reason || "\u2014"}</td>
                  <td>{entry.market_value ?? "\u2014"}</td>
                  <td>{entry.consideration_amount ?? "\u2014"}</td>
                  <td>{entry.stamp_duty ?? "\u2014"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Presentation Step 2 */}
        {entry && (
          <div className="pd-section">
            <h3 className="pd-section-title">Presentation Step 2</h3>
            <table className="pd-table pd-table-bordered">
              <thead>
                <tr>
                  <th>Doc Exe Code</th>
                  <th>Date of Stamp Purchase</th>
                  <th>DateOf Execution</th>
                  <th>Presentation Date</th>
                  <th>Stamp duty payable</th>
                  <th>No of Pages</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{entry.document_executed_in ? `Document Executed In ${entry.document_executed_in}` : "\u2014"}</td>
                  <td>{fmtDate(payments[0]?.payment_date)}</td>
                  <td>{fmtDate(entry.date_of_execution)}</td>
                  <td>{fmtDate(entry.date_of_presentation)}</td>
                  <td>{entry.stamp_duty ?? "\u2014"}</td>
                  <td>{entry.number_of_pages ?? "\u2014"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Payment Details */}
        <div className="pd-section">
          <h3 className="pd-section-title">Payment Details</h3>
          <table className="pd-table pd-table-bordered">
            <thead>
              <tr>
                <th>Type</th>
                <th>Vendors Name</th>
                <th>Purchasers Name</th>
                <th>Amount</th>
                <th>Amount Date</th>
                <th>Vendors Place</th>
                <th>Vendors Licenceno</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && (
                <tr><td colSpan={7} style={{ color: "#999" }}>No payments recorded.</td></tr>
              )}
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{(p.paid_by || "").charAt(0).toUpperCase() || "\u2014"}</td>
                  <td>{p.vendors_name || "\u2014"}</td>
                  <td>{p.purchasers_name || "\u2014"}</td>
                  <td>{p.amount}</td>
                  <td>{fmtDate(p.payment_date)}</td>
                  <td>{p.vendors_place || "\u2014"}</td>
                  <td>{p.vendors_licence_no || p.licence_no || p.franking_mc_no || "\u2014"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Property Details */}
        <div className="pd-section">
          <h3 className="pd-section-title">Property Details</h3>
          {properties.length === 0 && <p style={{ color: "#999" }}>No properties recorded.</p>}
          {properties.map((prop, idx) => {
            const attr1 = prop.attributes?.[0] || {};
            const attr2 = prop.attributes?.[1] || {};
            const attributeSummary = [attr1.value, attr2.value].filter(Boolean).join(" # ") || "\u2014";
            return (
              <div key={prop.id} className="pd-property-card">
                <h4 className="pd-property-num">Property Details {idx + 1}</h4>
                <table className="pd-table pd-table-detail">
                  <tbody>
                    <tr>
                      <th>Village Name</th><td>{prop.village_name || "\u2014"}</td>
                      <th>District Name</th><td>{prop.district || entry?.district_name || token?.district_name || "\u2014"}</td>
                    </tr>
                    <tr>
                      <th>Urban/Rural</th><td>{prop.urban_rural || "\u2014"}</td>
                      <th>HaddType</th><td>{prop.hadd_type || "\u2014"}</td>
                    </tr>
                    <tr>
                      <th>HaddName</th><td>{prop.hadd_name || "\u2014"}</td>
                      <th>Taluka Name</th><td>{prop.taluka || "\u2014"}</td>
                    </tr>
                    <tr>
                      <th>ZP</th><td>{prop.zp || "\u2014"}</td>
                      <th></th><td></td>
                    </tr>
                    <tr>
                      <th>Attribute</th><td colSpan={3}>{attributeSummary}</td>
                    </tr>
                    <tr>
                      <th>Area</th><td>{prop.area ?? "\u2014"}</td>
                      <th>Unit_code</th><td>{prop.area_unit || "\u2014"}</td>
                    </tr>
                    <tr>
                      <th>Flat Number</th><td>{prop.flat_no_en || "\u2014"}</td>
                      <th>Flat Number Mar</th><td>{prop.flat_no_mr || "\u2014"}</td>
                    </tr>
                    <tr>
                      <th>Floor Number</th><td>{prop.floor_no_en || "\u2014"}</td>
                      <th>Floor Number Mar</th><td>{prop.floor_no_mr || "\u2014"}</td>
                    </tr>
                    <tr>
                      <th>Building Name</th><td>{prop.building_name_en || "\u2014"}</td>
                      <th>Building Name Mar</th><td>{prop.building_name_mr || "\u2014"}</td>
                    </tr>
                    <tr>
                      <th>Block Sector</th><td>{prop.block_sector_en || "\u2014"}</td>
                      <th>Block Sector Mar</th><td>{prop.block_sector_mr || "\u2014"}</td>
                    </tr>
                    <tr>
                      <th>Road</th><td>{prop.road_en || "\u2014"}</td>
                      <th>Road Mar</th><td>{prop.road_mr || "\u2014"}</td>
                    </tr>
                    <tr>
                      <th>Other Details</th><td>{prop.other_desc || "\u2014"}</td>
                      <th>Other Details (Eng)</th><td>{prop.eother_desc || "\u2014"}</td>
                    </tr>
                    <tr>
                      <th>Potkharaba Area</th><td>{prop.potkharaba_area ?? "0.0"}</td>
                      <th>Other Right</th><td>{prop.other_right_mr || prop.other_right_en || "\u2014"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        {/* Party Details */}
        <div className="pd-section">
          <h3 className="pd-section-title">Party Details</h3>
          {parties.length === 0 && <p style={{ color: "#999" }}>No parties recorded.</p>}
          <table className="pd-table pd-table-bordered">
            <thead>
              <tr>
                <th>Sr</th>
                <th>Party Type</th>
                <th>Name</th>
                <th>Age</th>
                <th>UID</th>
                <th>PAN</th>
                <th>PAN Verified</th>
                <th>Mobile</th>
                <th>Mobile Verified</th>
                <th>Presentor</th>
              </tr>
            </thead>
            <tbody>
              {parties.map((p, idx) => (
                <tr key={p.id}>
                  <td>{idx + 1}</td>
                  <td>{p.party_type || "\u2014"}</td>
                  <td>{`${p.first_name_en || ""} ${p.surname_en || ""}`.trim() || "\u2014"}</td>
                  <td>{p.age ?? "\u2014"}</td>
                  <td>{p.uid || "\u2014"}</td>
                  <td>{p.pan_number || "\u2014"}</td>
                  <td>{p.pan_verified ? "True" : "False"}</td>
                  <td>{p.mobile_number || "\u2014"}</td>
                  <td>{p.mobile_number_verified ? "True" : "False"}</td>
                  <td>{p.is_presentor ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Identification / Witnesses */}
        {identifications.length > 0 && (
          <div className="pd-section">
            <h3 className="pd-section-title">Identification / Witnesses</h3>
            <table className="pd-table pd-table-bordered">
              <thead>
                <tr>
                  <th>Sr</th>
                  <th>Name</th>
                  <th>Age</th>
                  <th>Address</th>
                  <th>Proof</th>
                </tr>
              </thead>
              <tbody>
                {identifications.map((i, idx) => (
                  <tr key={i.id}>
                    <td>{idx + 1}</td>
                    <td>{`${i.first_name_en || ""} ${i.surname_en || ""}`.trim() || "\u2014"}</td>
                    <td>{i.age ?? "\u2014"}</td>
                    <td>{i.address_en || "\u2014"}</td>
                    <td>{`${i.identification_proof || ""} ${i.proof_number || ""}`.trim() || "\u2014"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}


        <div className="pd-actions">
          <button className="btn btn-blue" onClick={() => navigate("/tokens")}>&larr; Back to Tokens</button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
