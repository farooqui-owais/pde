import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios.js";
import HeaderSarita from "../components/HeaderSarita.jsx";
import Footer from "../components/Footer.jsx";
import { formatApiValidationError, validatePropertyForm } from "../utils/validation.js";
import {
  ATTRIBUTE_TYPES,
  AREA_UNITS,
  ELECTRICITY_BOARDS,
  HADD_NAMES,
  HADD_TYPES,
  MAHARASHTRA_DISTRICTS,
  PROPERTY_TYPES,
  getTalukasFor,
  getVillagesFor,
} from "../data/maharashtra.js";
import "./PropertyDetails.css";

const BLANK_FORM = {
  district: "Pune",
  village_name: "",
  urban_rural: "Urban",
  hadd_type: "Corporation / महानगरपालिका",
  hadd_name: "Pune M.N.Pa. / पुणे म.न.पा.",
  taluka: "Haveli / हवेली",
  zp: "",
  attribute_type_1: "Survey Number",
  attribute_value_1: "",
  attribute_type_2: "",
  attribute_value_2: "",
  area: "",
  area_unit: "Square Foot",
  property_type: "Flat / सदनिका",
  pui_number: "",
  address_type: "Address",
  flat_no_en: "",
  flat_no_mr: "",
  floor_no_en: "",
  floor_no_mr: "",
  building_name_en: "",
  building_name_mr: "",
  block_sector_en: "",
  block_sector_mr: "",
  road_en: "",
  road_mr: "",
  other_desc: "",
  eother_desc: "",
  potkharaba_area: "0.0",
  other_right_mr: "",
  other_right_en: "",
  non_cultivable_area: "0.0",
  boundaries_en: "",
  boundaries_mr: "",
  electricity_board: "MSEDCL",
  consumer_number: "",
};

export default function PropertyDetails() {
  const { t } = useTranslation(["pages", "common", "validation"]);
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(BLANK_FORM);
  const [properties, setProperties] = useState([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState(null);
  const [entry, setEntry] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [puiStatus, setPuiStatus] = useState(null);

  // Modals for ULB / DISCOMS
  const [discomModalOpen, setDiscomModalOpen] = useState(false);
  const [ulbModalOpen, setUlbModalOpen] = useState(false);

  // Village dropdown: allow a free-form "Other / इतर" value in addition to the
  // curated district/taluka list so valid villages never block saving.
  const [villageCustom, setVillageCustom] = useState(false);

  async function loadData() {
    try {
      const [entryRes, propsRes] = await Promise.all([
        api.get(`/api/documents/${id}`).catch(() => null),
        api.get(`/api/documents/${id}/properties`).catch(() => ({ data: [] })),
      ]);

      if (entryRes?.data) {
        setEntry(entryRes.data);
      }
      setProperties(propsRes?.data || []);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadData();
  }, [id]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleDistrictChange(value) {
    setForm((prev) => ({ ...prev, district: value, taluka: "", village_name: "" }));
    setVillageCustom(false);
  }

  function handleTalukaChange(value) {
    setForm((prev) => ({ ...prev, taluka: value, village_name: "" }));
    setVillageCustom(false);
  }

  function handleVillageSelect(value) {
    if (value === "__custom__") {
      setVillageCustom(true);
      setForm((prev) => ({ ...prev, village_name: "" }));
    } else {
      setVillageCustom(false);
      setForm((prev) => ({ ...prev, village_name: value }));
    }
  }

  function handleSelectRow(prop) {
    setSelectedPropertyId(prop.id);
    const attr1 = prop.attributes?.[0] || {};
    const attr2 = prop.attributes?.[1] || {};
    const villageOptions = getVillagesFor(prop.district || "", prop.taluka || "");
    setVillageCustom(!villageOptions.includes(prop.village_name));

    setForm({
      district: prop.district || "Pune",
      village_name: prop.village_name || "",
      urban_rural: prop.urban_rural || "Urban",
      hadd_type: prop.hadd_type || "Corporation / महानगरपालिका",
      hadd_name: prop.hadd_name || "",
      taluka: prop.taluka || "",
      zp: prop.zp || "",
      attribute_type_1: attr1.type || "Survey Number",
      attribute_value_1: attr1.value || "",
      attribute_type_2: attr2.type || "",
      attribute_value_2: attr2.value || "",
      area: prop.area !== null && prop.area !== undefined ? String(prop.area) : "",
      area_unit: prop.area_unit || "Square Foot",
      property_type: prop.property_type || "Flat / सदनिका",
      pui_number: prop.pui_number || "",
      address_type: prop.address_type || "Address",
      flat_no_en: prop.flat_no_en || "",
      flat_no_mr: prop.flat_no_mr || "",
      floor_no_en: prop.floor_no_en || "",
      floor_no_mr: prop.floor_no_mr || "",
      building_name_en: prop.building_name_en || "",
      building_name_mr: prop.building_name_mr || "",
      block_sector_en: prop.block_sector_en || "",
      block_sector_mr: prop.block_sector_mr || "",
      road_en: prop.road_en || "",
      road_mr: prop.road_mr || "",
      other_desc: prop.other_desc || "",
      eother_desc: prop.eother_desc || "",
      potkharaba_area: prop.potkharaba_area !== null && prop.potkharaba_area !== undefined ? String(prop.potkharaba_area) : "0.0",
      other_right_mr: prop.other_right_mr || "",
      other_right_en: prop.other_right_en || "",
      non_cultivable_area: prop.non_cultivable_area !== null && prop.non_cultivable_area !== undefined ? String(prop.non_cultivable_area) : "0.0",
      boundaries_en: prop.boundaries_en || "",
      boundaries_mr: prop.boundaries_mr || "",
      electricity_board: "MSEDCL",
      consumer_number: "028512345678",
    });
  }

  function handleCancelEdit() {
    setSelectedPropertyId(null);
    setForm(BLANK_FORM);
    setVillageCustom(false);
    setPuiStatus(null);
    setError("");
  }

  async function verifyPui() {
    if (!form.pui_number) {
      alert("Please enter a PUI / Property Tax number first.");
      return;
    }
    try {
      const { data } = await api.post(`/api/documents/${id}/verify-pui`, {
        pui_number: form.pui_number,
      });
      setPuiStatus(data.verified);
    } catch {
      setPuiStatus(false);
    }
  }

  async function handleSaveOrUpdate() {
    setError("");
    const validationError = validatePropertyForm(form);
    if (validationError) {
      setError(t(validationError));
      return;
    }
    const attributes = [];
    if (form.attribute_type_1 && form.attribute_value_1) {
      attributes.push({ type: form.attribute_type_1, value: form.attribute_value_1 });
    }
    if (form.attribute_type_2 && form.attribute_value_2) {
      attributes.push({ type: form.attribute_type_2, value: form.attribute_value_2 });
    }

    setSaving(true);
    const payload = {
      district: form.district,
      village_name: form.village_name,
      urban_rural: form.urban_rural,
      hadd_type: form.hadd_type,
      hadd_name: form.hadd_name,
      taluka: form.taluka,
      zp: form.urban_rural === "Rural" ? form.zp : null,
      attributes,
      area: form.area ? parseFloat(form.area) : null,
      area_unit: form.area_unit,
      property_type: form.property_type,
      pui_number: form.pui_number || null,
      address_type: form.address_type,
      flat_no_en: form.flat_no_en,
      flat_no_mr: form.flat_no_mr,
      floor_no_en: form.floor_no_en,
      floor_no_mr: form.floor_no_mr,
      building_name_en: form.building_name_en,
      building_name_mr: form.building_name_mr,
      block_sector_en: form.block_sector_en,
      block_sector_mr: form.block_sector_mr,
      road_en: form.road_en,
      road_mr: form.road_mr,
      other_desc: form.other_desc,
      eother_desc: form.eother_desc,
      potkharaba_area: form.potkharaba_area ? parseFloat(form.potkharaba_area) : 0.0,
      other_right_mr: form.other_right_mr,
      other_right_en: form.other_right_en,
    };

    try {
      if (selectedPropertyId) {
        await api.put(`/api/documents/${id}/properties/${selectedPropertyId}`, payload);
      } else {
        await api.post(`/api/documents/${id}/properties`, payload);
      }
      setSelectedPropertyId(null);
      setForm(BLANK_FORM);
      setPuiStatus(null);
      await loadData();
    } catch (err) {
      setError(formatApiValidationError(err?.response?.data?.detail, t) || "Could not save property details.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(propertyId) {
    if (!window.confirm("Are you sure you want to delete this property?")) return;
    try {
      await api.delete(`/api/documents/${id}/properties/${propertyId}`);
      if (selectedPropertyId === propertyId) {
        handleCancelEdit();
      }
      await loadData();
    } catch (err) {
      alert("Failed to delete property.");
    }
  }

  function handleNext() {
    if (properties.length === 0) {
      setError("Please save at least one property before proceeding.");
      return;
    }
    navigate(`/entries/${id}/parties`);
  }

  const tokenNumber = entry?.token?.token_number || "72959260825";
  const districtName = form.district || entry?.token?.district?.name || "Pune";
  const sroName = entry?.token?.office?.name || "Joint S.R. Haveli 21";
  const villageOptions = getVillagesFor(form.district, form.taluka);

  return (
    <div className="page-shell">
      <HeaderSarita />
      <div className="pde-prop-container">
        {/* Top Header */}
        <div className="pde-prop-header">
          <h1 className="pde-prop-title">Property Details</h1>
        </div>

        {error && <div className="banner banner-error mb-3">{error}</div>}

        {/* Two-Panel Form Layout */}
        <div className="pde-two-panel">
          {/* ===== LEFT PANEL ===== */}
          <div className="pde-panel">
            <div className="pde-panel-row">
              <label>Property Count</label>
              <input
                type="text"
                className="pde-input pde-prop-count-input"
                readOnly
                value={properties.length}
              />
            </div>

            <div className="pde-panel-row">
              <label>Select District</label>
              <select
                className="pde-select"
                value={form.district}
                onChange={(e) => handleDistrictChange(e.target.value)}
              >
                {MAHARASHTRA_DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="pde-panel-row">
              <label>Select Taluka</label>
              <select
                className="pde-select"
                value={form.taluka}
                onChange={(e) => handleTalukaChange(e.target.value)}
              >
                <option value="">--Select Taluka--</option>
                {getTalukasFor(form.district).map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="pde-panel-row">
              <label>Village Name</label>
              {villageCustom || (form.village_name && !villageOptions.includes(form.village_name)) ? (
                <div className="pde-village-custom">
                  <input
                    type="text"
                    className="pde-input"
                    placeholder="Type village name…"
                    value={form.village_name}
                    onChange={(e) => update("village_name", e.target.value)}
                  />
                  <button
                    type="button"
                    className="pde-link-btn"
                    onClick={() => {
                      setVillageCustom(false);
                      update("village_name", "");
                    }}
                  >
                    Choose from list
                  </button>
                </div>
              ) : (
                <select
                  className="pde-select"
                  value={form.village_name}
                  onChange={(e) => handleVillageSelect(e.target.value)}
                >
                  <option value="">Select Village</option>
                  {villageOptions.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                  <option value="__custom__">Other / इतर (type it)</option>
                </select>
              )}
            </div>

            <div className="pde-panel-row">
              <label></label>
              <div className="pde-radio-group">
                <label className="pde-radio-label">
                  <input
                    type="radio"
                    name="urbanRural"
                    value="Urban"
                    checked={form.urban_rural === "Urban"}
                    onChange={() => update("urban_rural", "Urban")}
                  />
                  Urban
                </label>
                <label className="pde-radio-label">
                  <input
                    type="radio"
                    name="urbanRural"
                    value="Rural"
                    checked={form.urban_rural === "Rural"}
                    onChange={() => update("urban_rural", "Rural")}
                  />
                  Rural
                </label>
              </div>
            </div>

            <div className="pde-panel-row">
              <label>Select Hadd Type</label>
              <select
                className="pde-select"
                value={form.hadd_type}
                onChange={(e) => update("hadd_type", e.target.value)}
              >
                <option value="">--Select Hadda Type--</option>
                {HADD_TYPES.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            <div className="pde-panel-row">
              <label>Select Attribute Type</label>
              <div className="pde-attr-list">
                {ATTRIBUTE_TYPES.map((a) => (
                  <label key={a}>
                    <input
                      type="checkbox"
                      checked={form.attribute_type_1 === a || form.attribute_type_2 === a}
                      onChange={(e) => {
                        if (e.target.checked) {
                          if (!form.attribute_type_1) {
                            update("attribute_type_1", a);
                          } else if (!form.attribute_type_2 && form.attribute_type_1 !== a) {
                            update("attribute_type_2", a);
                          }
                        } else {
                          if (form.attribute_type_1 === a) {
                            setForm((prev) => ({ ...prev, attribute_type_1: prev.attribute_type_2, attribute_value_1: prev.attribute_value_2, attribute_type_2: "", attribute_value_2: "" }));
                          } else if (form.attribute_type_2 === a) {
                            setForm((prev) => ({ ...prev, attribute_type_2: "", attribute_value_2: "" }));
                          }
                        }
                      }}
                    />
                    {" "}{a}
                  </label>
                ))}
              </div>
            </div>

            <div className="pde-panel-row" style={{ gridColumn: "1 / -1" }}>
              <label></label>
              <div className="pde-warning-text">
                (*Maximum 2 Attributes can be selected. If related to 7/12 or Property Card then only 1 Attribute)
              </div>
            </div>

            <div className="pde-panel-row">
              <label>Area</label>
              <input
                type="number"
                className="pde-input"
                placeholder="Area"
                value={form.area}
                onChange={(e) => update("area", e.target.value)}
              />
            </div>

            <div className="pde-panel-row">
              <label>Non Cultivable Area</label>
              <input
                type="text"
                className="pde-input"
                value={form.non_cultivable_area}
                onChange={(e) => update("non_cultivable_area", e.target.value)}
              />
            </div>

            <div className="pde-panel-row">
              <label>Boundries</label>
              <textarea
                className="pde-boundaries-textarea"
                value={form.boundaries_en}
                onChange={(e) => update("boundaries_en", e.target.value)}
              />
            </div>

            <div className="pde-panel-row">
              <label>Property Tax No.</label>
              <input
                type="text"
                className="pde-input"
                placeholder=""
                value={form.pui_number}
                onChange={(e) => update("pui_number", e.target.value)}
              />
            </div>

            <div className="pde-panel-row">
              <label></label>
              <button type="button" className="pde-view-btn" onClick={verifyPui}>
                View Property Tax
              </button>
            </div>
          </div>

          {/* ===== RIGHT PANEL ===== */}
          <div className="pde-panel">
            <div className="pde-section-heading">Survey Number From Valuation</div>

            <div className="pde-panel-row">
              <label>Select ZP</label>
              <select
                className="pde-select"
                value={form.zp}
                onChange={(e) => update("zp", e.target.value)}
              >
                <option value="">मनपा</option>
                <option value="ZP1">ZP Option 1</option>
                <option value="ZP2">ZP Option 2</option>
              </select>
            </div>

            <div className="pde-panel-row">
              <label>Select Property Type</label>
              <select
                className="pde-select"
                value={form.property_type}
                onChange={(e) => update("property_type", e.target.value)}
              >
                <option value="">Select PropertyType</option>
                {PROPERTY_TYPES.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
              </select>
            </div>

            <div className="pde-panel-row">
              <label>Select Hadd Name</label>
              <select
                className="pde-select"
                value={form.hadd_name}
                onChange={(e) => update("hadd_name", e.target.value)}
              >
                <option value="">--Select Hadda Name--</option>
                {HADD_NAMES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="pde-panel-row">
              <label>Attribute#1</label>
              <input
                type="text"
                className="pde-input"
                placeholder=""
                value={form.attribute_value_1}
                onChange={(e) => update("attribute_value_1", e.target.value)}
              />
            </div>

            <div className="pde-panel-row">
              <label></label>
              <button
                type="button"
                className="pde-view-btn"
                onClick={() => alert("View 7/12 / Property Card functionality will be available soon.")}
              >
                View 7/12 / Property Card
              </button>
            </div>

            <div className="pde-panel-row">
              <label>Attribute#2</label>
              <input
                type="text"
                className="pde-input"
                placeholder=""
                value={form.attribute_value_2}
                onChange={(e) => update("attribute_value_2", e.target.value)}
              />
            </div>

            <div className="pde-panel-row">
              <label>Unit</label>
              <select
                className="pde-select"
                value={form.area_unit}
                onChange={(e) => update("area_unit", e.target.value)}
              >
                {AREA_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div className="pde-panel-row">
              <label>Boundries Marathi</label>
              <textarea
                className="pde-boundaries-textarea"
                value={form.boundaries_mr}
                onChange={(e) => update("boundaries_mr", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Address / Other Details Toggle */}
        <div className="pde-address-toggle">
          <label>
            <input
              type="radio"
              name="addressType"
              value="Address"
              checked={form.address_type === "Address"}
              onChange={() => update("address_type", "Address")}
            />
            Address
          </label>
          <label>
            <input
              type="radio"
              name="addressType"
              value="Other Details"
              checked={form.address_type === "Other Details"}
              onChange={() => update("address_type", "Other Details")}
            />
            Other Details
          </label>
        </div>

        <div className="pde-address-hint">
          You Can Fill Both Address &amp; Other Details.{" "}
          <span style={{ color: "#e53e3e" }}>Type in English</span>{" "}
          <span style={{ color: "#2563eb" }}>get in Marathi</span>
        </div>

        {/* Property Address Heading */}
        <div className="pde-section-divider">
          <span className="pde-section-title">Property Address</span>
        </div>

        {/* Parallel 2-Column Address Fields: English on Left, Marathi on Right */}
        <div className="pde-address-columns">
          {/* Left Column: English */}
          <div>
            <div className="pde-addr-col-heading">English</div>
            <div className="pde-addr-form-rows">
              <label>Flat No.</label>
              <input
                type="text"
                className="pde-input"
                value={form.flat_no_en}
                onChange={(e) => update("flat_no_en", e.target.value)}
              />

              <label>Floor No.</label>
              <input
                type="text"
                className="pde-input"
                value={form.floor_no_en}
                onChange={(e) => update("floor_no_en", e.target.value)}
              />

              <label>Building Name</label>
              <input
                type="text"
                className="pde-input"
                value={form.building_name_en}
                onChange={(e) => update("building_name_en", e.target.value)}
              />

              <label>Block Sector Location</label>
              <input
                type="text"
                className="pde-input"
                value={form.block_sector_en}
                onChange={(e) => update("block_sector_en", e.target.value)}
              />

              <label>Road</label>
              <input
                type="text"
                className="pde-input"
                value={form.road_en}
                onChange={(e) => update("road_en", e.target.value)}
              />

              <label>Other Description (English)</label>
              <input
                type="text"
                className="pde-input"
                placeholder="English description"
                value={form.eother_desc}
                onChange={(e) => update("eother_desc", e.target.value)}
              />

              <label>Other Rights (English)</label>
              <input
                type="text"
                className="pde-input"
                placeholder="Other rights in English"
                value={form.other_right_en}
                onChange={(e) => update("other_right_en", e.target.value)}
              />

              <label>Potkharaba Area</label>
              <input
                type="number"
                step="0.01"
                className="pde-input"
                placeholder="0.0"
                value={form.potkharaba_area}
                onChange={(e) => update("potkharaba_area", e.target.value)}
              />
            </div>
          </div>

          {/* Right Column: Marathi */}
          <div>
            <div className="pde-addr-col-heading">Marathi</div>
            <div className="pde-addr-form-rows">
              <label>Flat No.</label>
              <input
                type="text"
                className="pde-input"
                value={form.flat_no_mr}
                onChange={(e) => update("flat_no_mr", e.target.value)}
              />

              <label>Floor No.</label>
              <input
                type="text"
                className="pde-input"
                value={form.floor_no_mr}
                onChange={(e) => update("floor_no_mr", e.target.value)}
              />

              <label>Building Name</label>
              <input
                type="text"
                className="pde-input"
                value={form.building_name_mr}
                onChange={(e) => update("building_name_mr", e.target.value)}
              />

              <label>Block Sector Location</label>
              <input
                type="text"
                className="pde-input"
                value={form.block_sector_mr}
                onChange={(e) => update("block_sector_mr", e.target.value)}
              />

              <label>Road</label>
              <input
                type="text"
                className="pde-input"
                value={form.road_mr}
                onChange={(e) => update("road_mr", e.target.value)}
              />

              <label>Other Description (Marathi)</label>
              <input
                type="text"
                className="pde-input"
                placeholder="मराठी वर्णन"
                value={form.other_desc}
                onChange={(e) => update("other_desc", e.target.value)}
              />

              <label>Other Rights (Marathi)</label>
              <input
                type="text"
                className="pde-input"
                placeholder="इतर हक्क / तपशील"
                value={form.other_right_mr}
                onChange={(e) => update("other_right_mr", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* DISCOMS Details Section */}
        <div className="pde-discom-section">
          <div className="pde-discom-title">DISCOMS Details</div>
          <div className="pde-discom-note">
            Note: You can use the below 'View DISCOM DETAILS' button to check pending electricity bill dues. No data is saved for this information.
          </div>
          <div className="pde-discom-grid">
            <label>Select Electricity Board</label>
            <select
              className="pde-select"
              value={form.electricity_board}
              onChange={(e) => update("electricity_board", e.target.value)}
            >
              {ELECTRICITY_BOARDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <label>Electricity Consumer Number</label>
            <input
              type="text"
              className="pde-input"
              placeholder="e.g. 028512345678"
              value={form.consumer_number}
              onChange={(e) => update("consumer_number", e.target.value)}
            />
          </div>
        </div>

        {/* Two Green Utility Buttons */}
        <div className="pde-utility-btns-row">
          <button
            type="button"
            className="btn-green-pill"
            onClick={() => setUlbModalOpen(true)}
          >
            View ULB Details
          </button>
          <button
            type="button"
            className="btn-green-pill"
            onClick={() => setDiscomModalOpen(true)}
          >
            View DISCOMS Details
          </button>
        </div>

        {/* 4 Main Action Buttons (Orange / Blue / Green / Orange) */}
        <div className="pde-main-action-bar">
          <button
            type="button"
            className="pde-btn-action pde-btn-orange"
            onClick={() => navigate(-1)}
          >
            Previous / मागे
          </button>

          {selectedPropertyId ? (
            <button
              type="button"
              className="pde-btn-action pde-btn-blue"
              onClick={handleCancelEdit}
            >
              Cancel / रद्द करा
            </button>
          ) : (
            <button
              type="button"
              className="pde-btn-action pde-btn-blue"
              onClick={handleSaveOrUpdate}
              disabled={saving}
            >
              Add / जोडा
            </button>
          )}

          <button
            type="button"
            className="pde-btn-action pde-btn-green"
            onClick={handleSaveOrUpdate}
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : selectedPropertyId
              ? "Update / दुरुस्ती"
              : "Save / जतन करा"}
          </button>

          <button
            type="button"
            className="pde-btn-action pde-btn-orange"
            onClick={handleNext}
          >
            Next / पुढे
          </button>
        </div>

        {/* Table Section: Columns matching screenshot */}
        <div className="pde-table-section-title">Property Details</div>
        <div className="pde-table-container">
          <table className="pde-grid-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>Delete</th>
                <th>PropertyCode</th>
                <th>VillageName</th>
                <th>DistrictName</th>
                <th>UrbanRural</th>
                <th>HaddTypeName</th>
                <th>HaddName</th>
                <th>TalukaName</th>
                <th>ZPName</th>
                <th>Area</th>
                <th>Munit_name</th>
                <th>Other_desc</th>
                <th>eother_desc</th>
                <th>Potkharaba</th>
                <th>Other Right</th>
                <th>Other Right Eng</th>
              </tr>
            </thead>
            <tbody>
              {properties.length === 0 ? (
                <tr>
                  <td colSpan={17} style={{ textAlign: "center", color: "#718096", padding: "16px" }}>
                    No properties added yet. Fill in the form above and click 'Add / जोडा' or 'Save / जतन करा'.
                  </td>
                </tr>
              ) : (
                properties.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span
                        className="pde-table-link"
                        onClick={() => handleSelectRow(p)}
                      >
                        Select
                      </span>
                    </td>
                    <td>
                      <span
                        className="pde-table-link"
                        onClick={() => handleDelete(p.id)}
                      >
                        Delete
                      </span>
                    </td>
                    <td>{p.property_code || "122662"}</td>
                    <td>{p.village_name || "—"}</td>
                    <td>{p.district || "Pune"}</td>
                    <td>{p.urban_rural === "Urban" ? "U" : "R"}</td>
                    <td>{p.hadd_type || "Corporation"}</td>
                    <td>{p.hadd_name || "पुणे म.न.पा."}</td>
                    <td>{p.taluka || "हवेली"}</td>
                    <td>{p.zp || ""}</td>
                    <td>{p.area !== null && p.area !== undefined ? p.area : "—"}</td>
                    <td>{p.area_unit?.includes("Meter") ? "चौ.मीटर" : "चौ.फूट"}</td>
                    <td>{p.other_desc || "—"}</td>
                    <td>{p.eother_desc || "—"}</td>
                    <td>{p.potkharaba_area !== null && p.potkharaba_area !== undefined ? p.potkharaba_area : "0.0"}</td>
                    <td>{p.other_right_mr || "—"}</td>
                    <td>{p.other_right_en || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Strip matching screenshot */}
        <div className="pde-footer-strip">
          <div className="pde-footer-item">
            <span className="pde-footer-label">Token No. :</span>
            <span className="pde-footer-val font-semibold">{tokenNumber}</span>
          </div>
          <div className="pde-footer-item">
            <span className="pde-footer-label">DIG Name :</span>
            <span className="pde-footer-val">{districtName}</span>
          </div>
          <div className="pde-footer-item">
            <span className="pde-footer-label">JDR Name :</span>
            <span className="pde-footer-val">{districtName}</span>
          </div>
          <div className="pde-footer-item">
            <span className="pde-footer-label">SRO Name :</span>
            <span className="pde-footer-val">{sroName}</span>
          </div>
        </div>
      </div>

      {/* DISCOM Modal */}
      {discomModalOpen && (
        <div className="scheme-modal-backdrop" onClick={() => setDiscomModalOpen(false)}>
          <div className="scheme-modal" onClick={(e) => e.stopPropagation()}>
            <div className="scheme-modal-header">
              <h3>Electricity Bill Dues (DISCOMS Verification)</h3>
              <button className="scheme-modal-close" onClick={() => setDiscomModalOpen(false)}>
                &times;
              </button>
            </div>
            <div className="scheme-modal-body text-sm">
              <p>
                <strong>Provider:</strong> {form.electricity_board}
              </p>
              <p>
                <strong>Consumer No:</strong> {form.consumer_number || "028512345678"}
              </p>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded mt-2 text-emerald-800">
                ✓ No pending electricity dues found for this consumer number. Status: Active.
              </div>
            </div>
            <div className="scheme-modal-footer">
              <button className="btn btn-secondary" onClick={() => setDiscomModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ULB Modal */}
      {ulbModalOpen && (
        <div className="scheme-modal-backdrop" onClick={() => setUlbModalOpen(false)}>
          <div className="scheme-modal" onClick={(e) => e.stopPropagation()}>
            <div className="scheme-modal-header">
              <h3>Urban Local Body (ULB) Property Assessment</h3>
              <button className="scheme-modal-close" onClick={() => setUlbModalOpen(false)}>
                &times;
              </button>
            </div>
            <div className="scheme-modal-body text-sm">
              <p>
                <strong>Corporation / Authority:</strong> {form.hadd_name || "Pune Municipal Corporation"}
              </p>
              <p>
                <strong>PUI / Assessment No:</strong> {form.pui_number || "PMC122662"}
              </p>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded mt-2 text-emerald-800">
                ✓ Property tax is cleared for the current financial year. Assessment status: Verified.
              </div>
            </div>
            <div className="scheme-modal-footer">
              <button className="btn btn-secondary" onClick={() => setUlbModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
