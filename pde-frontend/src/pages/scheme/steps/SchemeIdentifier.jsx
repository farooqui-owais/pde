import React, { useState, useEffect } from "react";
import schemeApi from "../../../api/schemeApi";

export default function SchemeIdentifier({ schemeId, scheme, onNext, onBack }) {
  const [identifier, setIdentifier] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form fields
  const [name, setName] = useState("");
  const [identifierType, setIdentifierType] = useState("Identifier / Witness");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("Male");
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [address, setAddress] = useState("");
  const [state, setState] = useState("Maharashtra");
  const [district, setDistrict] = useState(scheme?.project?.district || "Pune");
  const [taluka, setTaluka] = useState(scheme?.project?.taluka || "Haveli");
  const [village, setVillage] = useState(scheme?.project?.village || "");
  const [pincode, setPincode] = useState("");
  const [occupation, setOccupation] = useState("Service / Business");

  const fetchIdentifier = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await schemeApi.getSchemeIdentifier(schemeId);
      if (res.data) {
        setIdentifier(res.data);
        setName(res.data.name || "");
        setIdentifierType(res.data.identifier_type || "Identifier / Witness");
        setAge(res.data.age ? String(res.data.age) : "");
        setGender(res.data.gender || "Male");
        setMobileNumber(res.data.mobile_number || "");
        setEmail(res.data.email || "");
        setPanNumber(res.data.pan_number || "");
        setAadhaarNumber(res.data.aadhaar_number || "");
        setAddress(res.data.address || "");
        setState(res.data.state || "Maharashtra");
        setDistrict(res.data.district || "Pune");
        setTaluka(res.data.taluka || "Haveli");
        setVillage(res.data.village || "");
        setPincode(res.data.pincode || "");
        setOccupation(res.data.occupation || "Service / Business");
      }
    } catch (err) {
      // 404 is normal if not created yet
      if (err.response?.status !== 404) {
        console.error(err);
        setError(err.response?.data?.detail || "Failed to load identifier.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (schemeId) fetchIdentifier();
  }, [schemeId]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name) {
      alert("Identifier / Witness Name is required.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      name,
      identifier_type: identifierType,
      age: age ? parseInt(age) : null,
      gender,
      mobile_number: mobileNumber,
      email,
      pan_number: panNumber,
      aadhaar_number: aadhaarNumber,
      address,
      state,
      district,
      taluka,
      village,
      pincode,
      occupation,
    };

    try {
      const res = await schemeApi.saveSchemeIdentifier(schemeId, payload);
      setIdentifier(res.data);
      setSuccess("Scheme identifier details saved successfully.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to save identifier.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="step-card">
      <div className="step-card-header">
        <div>
          <h2 className="step-title">Step 2: Scheme Identifier / ओळखकर्ता तपशील</h2>
          <p className="step-desc">
            Provide details of the official identifier/witness associated with this scheme.
          </p>
        </div>
      </div>

      {error && <div className="scheme-error-box">{error}</div>}
      {success && <div className="scheme-success-box">{success}</div>}

      <form className="step-form-container" onSubmit={handleSave}>
        <div className="form-grid-3">
          <div className="form-group">
            <label>Identifier Type *</label>
            <select
              className="scheme-select"
              value={identifierType}
              onChange={(e) => setIdentifierType(e.target.value)}
              required
            >
              <option value="Identifier / Witness">Identifier / Witness</option>
              <option value="Advocate / Legal Representative">Advocate / Legal Representative</option>
              <option value="Authorized Representative">Authorized Representative</option>
            </select>
          </div>

          <div className="form-group">
            <label>Full Legal Name *</label>
            <input
              type="text"
              className="scheme-input"
              placeholder="e.g. Ramesh Shankar Patil"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Age & Gender</label>
            <div className="flex gap-2">
              <input
                type="number"
                className="scheme-input"
                placeholder="Age"
                style={{ width: "80px" }}
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
              <select
                className="scheme-select"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        </div>

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
              placeholder="identifier@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Occupation</label>
            <input
              type="text"
              className="scheme-input"
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
            />
          </div>
        </div>

        <div className="form-grid-3 mt-2">
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

        <div className="form-grid-2 mt-2">
          <div className="form-group">
            <label>Residential / Office Address</label>
            <input
              type="text"
              className="scheme-input"
              placeholder="Full address details"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Taluka & District</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="scheme-input"
                placeholder="Taluka"
                value={taluka}
                onChange={(e) => setTaluka(e.target.value)}
              />
              <input
                type="text"
                className="scheme-input"
                placeholder="District"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : identifier ? "Update Identifier Details" : "Save Identifier Details"}
          </button>
        </div>
      </form>

      <div className="step-footer-actions">
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back to Sellers
        </button>
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={!identifier && !name}
        >
          Next: Upload Document →
        </button>
      </div>
    </div>
  );
}
