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
                  <td>{entry.article_type_id || "\u2014"}</td>
                  <td>{entry.document_title || "\u2014"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Presenter Info */}
        {token && (
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
                  <td>{token.presenter_name || "\u2014"}</td>
                  <td>\u2014</td>
                  <td>\u2014</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Presentation Step 1 Summary */}
        {entry && (
          <div className="pd-section">
            <table className="pd-table pd-table-bordered">
              <thead>
                <tr>
                  <th>Presenter Type</th>
                  <th>No</th>
                  <th>Valuation Text</th>
                  <th>valuation_rupees</th>
                  <th>Stock Value</th>
                  <th>Consideration</th>
                  <th>Amt</th>
                  <th>Stamp Duty Calc</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Purchaser/Buyer/Executor</td>
                  <td>\u2014</td>
                  <td>\u2014</td>
                  <td>{entry.market_value || "\u2014"}</td>
                  <td>{entry.market_value || "\u2014"}</td>
                  <td>{entry.consideration_amount || "\u2014"}</td>
                  <td>\u2014</td>
                  <td>{entry.stamp_duty || "\u2014"}</td>
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
                  <th>Doc Exec Code</th>
                  <th>Date of Stamp Purchase</th>
                  <th>DateOf Execution</th>
                  <th>Presentation Date</th>
                  <th>Stamp duty payable</th>
                  <th>No of Pages</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{entry.document_title || "\u2014"}</td>
                  <td>\u2014</td>
                  <td>{fmtDate(entry.date_of_execution)}</td>
                  <td>{fmtDate(entry.date_of_presentation)}</td>
                  <td>{entry.stamp_duty || "\u2014"}</td>
                  <td>{entry.number_of_pages || "\u2014"}</td>
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
                <th>Vendor Licence No</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && (
                <tr><td colSpan={7} style={{ color: "#999" }}>No payments recorded.</td></tr>
              )}
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.paid_by}</td>
                  <td>{p.vendors_name || "\u2014"}</td>
                  <td>{p.purchasers_name || "\u2014"}</td>
                  <td>{p.amount}</td>
                  <td>{fmtDate(p.payment_date)}</td>
                  <td>{p.vendors_place || "\u2014"}</td>
                  <td>{p.licence_no || p.franking_mc_no || "\u2014"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Property Details */}
        <div className="pd-section">
          <h3 className="pd-section-title">Property Details</h3>
          {properties.length === 0 && <p style={{ color: "#999" }}>No properties recorded.</p>}
          {properties.map((prop, idx) => (
            <div key={prop.id} className="pd-property-card">
              <h4 className="pd-property-num">Property Details {idx + 1}</h4>
              <table className="pd-table pd-table-detail">
                <tbody>
                  <tr>
                    <th>Village Name</th><td>{prop.village_name || "\u2014"}</td>
                    <th>District Name</th><td>{entry?.district_name || token?.district_name || "\u2014"}</td>
                  </tr>
                  <tr>
                    <th>Urban/Rural</th><td>{prop.urban_rural || "\u2014"}</td>
                    <th>Roof Type</th><td>{prop.roof_type || "\u2014"}</td>
                  </tr>
                  <tr>
                    <th>Hadd Name</th><td>{prop.hadd_type || "\u2014"}</td>
                    <th>Taluka Name</th><td>{prop.taluka_name || "\u2014"}</td>
                  </tr>
                  <tr>
                    <th>CS</th><td>{prop.cs_number || "\u2014"}</td>
                    <th></th><td></td>
                  </tr>
                  <tr>
                    <th>Attributes</th><td colSpan={3}>{prop.attributes || "\u2014"}</td>
                  </tr>
                  <tr>
                    <th>Area</th><td>{prop.area || "\u2014"}</td>
                    <th>Unit_Zone</th><td>{prop.unit_zone || "\u2014"}</td>
                  </tr>
                  <tr>
                    <th>Flat Number</th><td>{prop.flat_number || "\u2014"}</td>
                    <th>Flat Number Mar</th><td>{prop.flat_number_mar || "\u2014"}</td>
                  </tr>
                  <tr>
                    <th>Floor Number</th><td>{prop.floor_number || "\u2014"}</td>
                    <th>Floor Number Mar</th><td>{prop.floor_number_mar || "\u2014"}</td>
                  </tr>
                  <tr>
                    <th>Building Name</th><td>{prop.building_name || "\u2014"}</td>
                    <th>Building Name Mar</th><td>{prop.building_name_mar || "\u2014"}</td>
                  </tr>
                  <tr>
                    <th>Block Society</th><td>{prop.block_society || "\u2014"}</td>
                    <th>Block Society Mar</th><td>{prop.block_society_mar || "\u2014"}</td>
                  </tr>
                  <tr>
                    <th>Road</th><td>{prop.road || "\u2014"}</td>
                    <th>Road Mar</th><td>{prop.road_mar || "\u2014"}</td>
                  </tr>
                  <tr>
                    <th>Other Details</th><td>{prop.other_details || "\u2014"}</td>
                    <th>Other Details</th><td>{prop.other_details_mar || "\u2014"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* Party Details */}
        <div className="pd-section">
          <h3 className="pd-section-title">Party Details</h3>
          {parties.length === 0 && <p style={{ color: "#999" }}>No parties recorded.</p>}
          <table className="pd-table pd-table-bordered">
            <thead>
              <tr>
                <th>Sr</th>
                <th>Name</th>
                <th>Age</th>
                <th>UID</th>
                <th>PAN</th>
                <th>Mobile</th>
                <th>Presentor</th>
              </tr>
            </thead>
            <tbody>
              {parties.map((p, idx) => (
                <tr key={p.id}>
                  <td>{idx + 1}</td>
                  <td>{`${p.first_name_en || ""} ${p.surname_en || ""}`.trim() || "\u2014"}</td>
                  <td>{p.age || "\u2014"}</td>
                  <td>{p.uid || "\u2014"}</td>
                  <td>{p.pan_number || "\u2014"}</td>
                  <td>{p.mobile_number || "\u2014"}</td>
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
                    <td>{i.age || "\u2014"}</td>
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
