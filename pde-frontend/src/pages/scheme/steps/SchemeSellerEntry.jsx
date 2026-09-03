import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import schemeApi from "../../../api/schemeApi";
import { formatApiValidationError, validateSchemeSellerForm } from "../../../utils/validation.js";

const CATEGORIES = [
  "Individual",
  "Company",
  "Partnership",
  "Power of Attorney",
  "Community Base Organization",
  "Licensor",
  "Builder/Purchaser",
];

export default function SchemeSellerEntry({ schemeId, scheme, onNext }) {
  const { t } = useTranslation(["validation"]);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [category, setCategory] = useState("Individual");
  const [partyName, setPartyName] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [state, setState] = useState("Maharashtra");
  const [district, setDistrict] = useState(scheme?.project?.district || "Pune");
  const [taluka, setTaluka] = useState(scheme?.project?.taluka || "Haveli");
  const [village, setVillage] = useState(scheme?.project?.village || "");
  const [pincode, setPincode] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [poaHolderName, setPoaHolderName] = useState("");
  const [poaDocNumber, setPoaDocNumber] = useState("");

  const fetchSellers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await schemeApi.getSellerParties(schemeId);
      setSellers(res.data || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to load seller parties.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (schemeId) fetchSellers();
  }, [schemeId]);

  const resetForm = () => {
    setEditingId(null);
    setCategory("Individual");
    setPartyName("");
    setPanNumber("");
    setAadhaarNumber("");
    setMobileNumber("");
    setEmail("");
    setAddressLine1("");
    setCompanyName("");
    setRegistrationNumber("");
    setPoaHolderName("");
    setPoaDocNumber("");
    setShowForm(false);
  };

  const handleEdit = (seller) => {
    setEditingId(seller.id);
    setCategory(seller.party_category || "Individual");
    setPartyName(seller.party_name || "");
    setPanNumber(seller.pan_number || "");
    setAadhaarNumber(seller.aadhaar_number || "");
    setMobileNumber(seller.mobile_number || "");
    setEmail(seller.email || "");
    setAddressLine1(seller.address_line1 || "");
    setState(seller.state || "Maharashtra");
    setDistrict(seller.district || "Pune");
    setTaluka(seller.taluka || "Haveli");
    setVillage(seller.village || "");
    setPincode(seller.pincode || "");
    setCompanyName(seller.company_name || "");
    setRegistrationNumber(seller.registration_number || "");
    setPoaHolderName(seller.poa_holder_name || "");
    setPoaDocNumber(seller.poa_document_number || "");
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to remove this seller party?")) return;
    try {
      await schemeApi.deleteSellerParty(id);
      fetchSellers();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete party.");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!partyName) {
      alert("Party / Seller Name is required.");
      return;
    }
    setSaving(true);
    const payload = {
      party_category: category,
      party_name: partyName,
      pan_number: panNumber,
      aadhaar_number: aadhaarNumber,
      mobile_number: mobileNumber,
      email: email,
      address_line1: addressLine1,
      state: state,
      district: district,
      taluka: taluka,
      village: village,
      pincode: pincode,
      company_name: companyName,
      registration_number: registrationNumber,
      poa_holder_name: poaHolderName,
      poa_document_number: poaDocNumber,
    };

    try {
      if (editingId) {
        await schemeApi.updateSellerParty(editingId, payload);
      } else {
        await schemeApi.createSellerParty(schemeId, payload);
      }
      resetForm();
      fetchSellers();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Failed to save seller party.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="step-card">
      <div className="step-card-header">
        <div>
          <h2 className="step-title">Step 1: Scheme Seller Entry / विक्रेता तपशील</h2>
          <p className="step-desc">
            Add developers, landowners, companies, or POA holders representing the seller side of this scheme.
          </p>
        </div>
        {!showForm && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
            + Add Seller Party
          </button>
        )}
      </div>

      {error && <div className="scheme-error-box">{error}</div>}

      {/* Seller Party Form */}
      {showForm && (
        <form className="step-form-container" onSubmit={handleSave}>
          <h3 className="text-md font-bold mb-3 text-sky-800">
            {editingId ? "Edit Seller Party" : "Add New Seller Party"}
          </h3>

          <div className="form-grid-3">
            <div className="form-group">
              <label>Party Category *</label>
              <select
                className="scheme-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Party / Seller Name *</label>
              <input
                type="text"
                className="scheme-input"
                placeholder="Full Legal Name"
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>PAN Number</label>
              <input
                type="text"
                className="scheme-input"
                placeholder="ABCDE1234F"
                maxLength={10}
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
              />
            </div>
          </div>

          {/* Conditional Category Fields */}
          {(category === "Company" || category === "Partnership" || category === "Community Base Organization") && (
            <div className="form-grid-2 mt-2">
              <div className="form-group">
                <label>Company / Firm / Organization Name</label>
                <input
                  type="text"
                  className="scheme-input"
                  placeholder="Registered Entity Name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Registration / CIN / LLPIN Number</label>
                <input
                  type="text"
                  className="scheme-input"
                  placeholder="e.g. U70100MH2020PTC123456"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                />
              </div>
            </div>
          )}

          {category === "Power of Attorney" && (
            <div className="form-grid-2 mt-2">
              <div className="form-group">
                <label>POA Holder Name</label>
                <input
                  type="text"
                  className="scheme-input"
                  placeholder="Name of attorney representative"
                  value={poaHolderName}
                  onChange={(e) => setPoaHolderName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>POA Document Number / Registration Ref</label>
                <input
                  type="text"
                  className="scheme-input"
                  placeholder="Doc Reg No / Year"
                  value={poaDocNumber}
                  onChange={(e) => setPoaDocNumber(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="form-grid-3 mt-2">
            <div className="form-group">
              <label>Mobile Number</label>
              <input
                type="tel"
                className="scheme-input"
                placeholder="10-digit mobile"
                maxLength={15}
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                className="scheme-input"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Aadhaar / UID (Optional)</label>
              <input
                type="text"
                className="scheme-input"
                placeholder="12-digit UID"
                maxLength={14}
                value={aadhaarNumber}
                onChange={(e) => setAadhaarNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="form-grid-3 mt-2">
            <div className="form-group">
              <label>Address / Locality</label>
              <input
                type="text"
                className="scheme-input"
                placeholder="Building, street, area"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Taluka / Tehsil</label>
              <input
                type="text"
                className="scheme-input"
                value={taluka}
                onChange={(e) => setTaluka(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Pincode</label>
              <input
                type="text"
                className="scheme-input"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button type="button" className="btn btn-secondary" onClick={resetForm} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update Party" : "Save Party"}
            </button>
          </div>
        </form>
      )}

      {/* Seller Party List Table */}
      <div className="step-table-wrapper mt-4">
        <table className="scheme-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Seller / Party Name</th>
              <th>PAN / Reg No.</th>
              <th>Contact</th>
              <th>Location</th>
              <th style={{ textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="scheme-loading-cell">
                  Loading seller parties...
                </td>
              </tr>
            ) : sellers.length === 0 ? (
              <tr>
                <td colSpan="6" className="scheme-empty-cell">
                  No seller parties added yet. Please add at least one seller party to proceed.
                </td>
              </tr>
            ) : (
              sellers.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span className="scheme-badge badge-submitted">{s.party_category}</span>
                  </td>
                  <td className="font-semibold">{s.party_name}</td>
                  <td>{s.pan_number || s.registration_number || "—"}</td>
                  <td>{s.mobile_number || s.email || "—"}</td>
                  <td>{s.village ? `${s.village}, ${s.taluka}` : s.district || "Maharashtra"}</td>
                  <td style={{ textAlign: "center" }}>
                    <button className="btn btn-secondary btn-xs mr-2" onClick={() => handleEdit(s)}>
                      Edit
                    </button>
                    <button className="btn btn-secondary btn-xs" onClick={() => handleDelete(s.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="step-footer-actions">
        <div></div>
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={sellers.length === 0}
        >
          Next: Scheme Identifier →
        </button>
      </div>
    </div>
  );
}
