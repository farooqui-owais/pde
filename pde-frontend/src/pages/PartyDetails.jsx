import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios.js";
import HeaderSarita from "../components/HeaderSarita.jsx";
import Footer from "../components/Footer.jsx";
import { formatApiValidationError, validatePartyForm } from "../utils/validation.js";
import { useEnMrAutoTranslate } from "../hooks/useEnMrAutoTranslate.js";
import { TRANSLATION_PAIRS } from "../utils/translationPairs.js";
import DropdownOrText from "../components/common/DropdownOrText.jsx";
import {
  COUNTRIES,
  ENTITY_TYPES,
  EXECUTION_BY_OPTIONS,
  GENDERS,
  ID_TYPES,
  INDIAN_STATES,
  OCCUPATIONS,
  SALUTATIONS,
  getCitiesFor,
} from "../data/party.js";
import { MAHARASHTRA_DISTRICTS } from "../data/maharashtra.js";
import "./EntrySteps.css";

const PARTY_TYPES = ["Seller/Vendor", "Purchaser", "Bank/Financial Institution", "Power of Attorney Holder", "Witness Party"];
const ID_PROOFS = ["Aadhar Card", "PAN Card", "Passport", "Voter ID", "Driving Licence"];

const BLANK = {
  party_type: "", entity_type: "", salutation: "", surname_en: "", first_name_en: "", middle_name_en: "",
  surname_mr: "", first_name_mr: "", middle_name_mr: "", age: "",
  occupation: "", gender: "", date_of_birth: "",
  is_bank: false, is_stamp_purchaser: false, is_presentor: false,
  flat_no_en: "", flat_no_mr: "", floor_no_en: "", floor_no_mr: "",
  building_name_en: "", building_name_mr: "", block_sector_en: "", block_sector_mr: "",
  road_en: "", road_mr: "", pin_code: "", country: "India",
  state_en: "", city_en: "", district_name: "",
  uid: "", mobile_number: "", mobile_number_verified: false,
  identification_mark1: "", identification_mark2: "",
  pan_number: "", declaration_form_60_61: false,
  identification_proof: "Aadhar Card", identification_proof_number: "",
  email: "", is_document_signed: false, is_exemption_section_88: false,
  uid_consent_aadhaar: false,
  state_mr: "", district_mr: "", city_mr: "",
  execution_by: "self",
  // Gap 2 fields
  party_sr_no: "", alias_name_mr: "", alias_name_en: "", id_type: "PAN", id_no: "",
  full_pan_name: "", survey_no: "", khata_no: "", party_area: "", vikri_area: "",
  potkharaba_area: "", potkharaba_vikri_area: "", seller_khata_no: "",
  seller_first_name: "", seller_middle_name: "", seller_last_name: "",
};

export default function PartyDetails() {
  const { t } = useTranslation(["pages", "common", "validation"]);
  const { id } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(BLANK);
  const [parties, setParties] = useState([]);
  const [isRural, setIsRural] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [panStatus, setPanStatus] = useState(null);
  const [mobileStatus, setMobileStatus] = useState(null);
  const [selectedPartyId, setSelectedPartyId] = useState(null);
  const [docMeta, setDocMeta] = useState(null);

  async function load() {
    try {
      const [partiesRes, propsRes, docRes] = await Promise.all([
        api.get(`/api/documents/${id}/parties`).catch(() => ({ data: [] })),
        api.get(`/api/documents/${id}/properties`).catch(() => ({ data: [] })),
        // Read-only transaction metadata (Token No., DIG, JDR, SRO — spec §40)
        api.get(`/api/documents/${id}`).catch(() => ({ data: null })),
      ]);
      setParties(partiesRes.data || []);
      const rural = (propsRes.data || []).some((p) => p.urban_rural === "Rural");
      setIsRural(rural);
      setDocMeta(docRes.data || null);
    } catch {
      setParties([]);
    }
  }

  useEffect(() => {
    load();
    /* eslint-disable-next-line */
  }, [id]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // Auto-translate paired English → Marathi fields (PartyDetails config).
  useEnMrAutoTranslate(form, update, TRANSLATION_PAIRS.PartyDetails);

  // When the State changes, the City list is state-dependent, so clear it to
  // avoid keeping a city that doesn't belong to the newly-selected state.
  function handleStateChange(value) {
    setForm((f) => ({ ...f, state_en: value, city_en: "" }));
  }

  async function verifyPan() {
    if (!form.pan_number) return;
    try {
      const { data } = await api.post(`/api/documents/${id}/verify-pan`, { pan_number: form.pan_number });
      setPanStatus(data.verified);
    } catch {
      setPanStatus(false);
    }
  }

  async function verifyMobile() {
    if (!form.mobile_number) return;
    if (selectedPartyId) {
      try {
        const { data } = await api.post(`/api/documents/${id}/parties/${selectedPartyId}/verify-mobile`);
        setMobileStatus(data.verified);
        update("mobile_number_verified", true);
      } catch {
        setMobileStatus(false);
      }
    } else {
      update("mobile_number_verified", true);
      setMobileStatus(true);
    }
  }

  function handleSelectRow(p) {
    setSelectedPartyId(p.id);
    setForm({
      party_type: p.party_type || "",
      entity_type: p.entity_type || "",
      salutation: p.salutation || "",
      surname_en: p.surname_en || "",
      first_name_en: p.first_name_en || "",
      middle_name_en: p.middle_name_en || "",
      surname_mr: p.surname_mr || "",
      first_name_mr: p.first_name_mr || "",
      middle_name_mr: p.middle_name_mr || "",
      occupation: p.occupation || "",
      gender: p.gender || "",
      date_of_birth: p.date_of_birth || "",
      age: p.age !== null && p.age !== undefined ? String(p.age) : "",
      is_bank: !!p.is_bank,
      is_stamp_purchaser: !!p.is_stamp_purchaser,
      is_presentor: !!p.is_presentor,
      flat_no_en: p.flat_no_en || "",
      flat_no_mr: p.flat_no_mr || "",
      floor_no_en: p.floor_no_en || "",
      floor_no_mr: p.floor_no_mr || "",
      building_name_en: p.building_name_en || "",
      building_name_mr: p.building_name_mr || "",
      block_sector_en: p.block_sector_en || "",
      block_sector_mr: p.block_sector_mr || "",
      road_en: p.road_en || "",
      road_mr: p.road_mr || "",
      pin_code: p.pin_code || "",
      country: p.country || "India",
      state_en: p.state_en || "",
      city_en: p.city_en || "",
      district_name: p.district_name || "",
      uid: p.uid || "",
      mobile_number: p.mobile_number || "",
      mobile_number_verified: !!p.mobile_number_verified,
      identification_mark1: p.identification_mark1 || "",
      identification_mark2: p.identification_mark2 || "",
      pan_number: p.pan_number || "",
      declaration_form_60_61: !!p.declaration_form_60_61,
      identification_proof: p.identification_proof || "Aadhar Card",
      identification_proof_number: p.identification_proof_number || "",
      email: p.email || "",
      execution_by: p.execution_by || "self",
      uid_consent_aadhaar: !!p.uid_consent_aadhaar,
      state_mr: p.state_mr || "",
      district_mr: p.district_mr || "",
      city_mr: p.city_mr || "",
      is_document_signed: p.is_document_signed !== false,
      is_exemption_section_88: !!p.is_exemption_section_88,
      party_sr_no: p.party_sr_no !== null && p.party_sr_no !== undefined ? String(p.party_sr_no) : "",
      alias_name_mr: p.alias_name_mr || "",
      alias_name_en: p.alias_name_en || "",
      id_type: p.id_type || "PAN",
      id_no: p.id_no || "",
      full_pan_name: p.full_pan_name || "",
      survey_no: p.survey_no || "",
      khata_no: p.khata_no || "",
      party_area: p.party_area !== null && p.party_area !== undefined ? String(p.party_area) : "",
      vikri_area: p.vikri_area !== null && p.vikri_area !== undefined ? String(p.vikri_area) : "",
      potkharaba_area: p.potkharaba_area !== null && p.potkharaba_area !== undefined ? String(p.potkharaba_area) : "",
      potkharaba_vikri_area: p.potkharaba_vikri_area !== null && p.potkharaba_vikri_area !== undefined ? String(p.potkharaba_vikri_area) : "",
      seller_khata_no: p.seller_khata_no || "",
      seller_first_name: p.seller_first_name || "",
      seller_middle_name: p.seller_middle_name || "",
      seller_last_name: p.seller_last_name || "",
    });
    setPanStatus(p.pan_verified ? true : null);
    setMobileStatus(p.mobile_number_verified ? true : null);
  }

  // asNew (spec §34 "Add"): always create a fresh record, even when a row is
  // selected for editing. Save updates the selected record when one exists.
  // Returns true when a record was saved, false on validation/API error.
  async function handleAddOrUpdate(asNew = false) {
    setError("");
    const validationError = validatePartyForm(form);
    if (validationError) {
      setError(t(validationError));
      return false;
    }
    setSaving(true);
    const payload = {
      ...form,
      age: form.age ? Number(form.age) : null,
      party_sr_no: form.party_sr_no ? Number(form.party_sr_no) : parties.length + 1,
      party_area: form.party_area ? parseFloat(form.party_area) : null,
      vikri_area: form.vikri_area ? parseFloat(form.vikri_area) : null,
      potkharaba_area: form.potkharaba_area ? parseFloat(form.potkharaba_area) : null,
      potkharaba_vikri_area: form.potkharaba_vikri_area ? parseFloat(form.potkharaba_vikri_area) : null,
    };
    try {
      const targetId = asNew ? null : selectedPartyId;
      if (targetId) {
        await api.put(`/api/documents/${id}/parties/${targetId}`, payload);
      } else {
        await api.post(`/api/documents/${id}/parties`, payload);
      }
      setForm(BLANK);
      setSelectedPartyId(null);
      setPanStatus(null);
      setMobileStatus(null);
      await load();
      return true;
    } catch (err) {
      setError(formatApiValidationError(err?.response?.data?.detail, t) || t("party.couldNotSave"));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(partyId) {
    // Confirmation before deleting a persisted party (spec §35)
    if (!window.confirm(t("party.deleteConfirm"))) return;
    try {
      await api.delete(`/api/documents/${id}/parties/${partyId}`);
      if (selectedPartyId === partyId) {
        setSelectedPartyId(null);
        setForm(BLANK);
      }
      await load();
    } catch {
      /* ignore */
    }
  }

  async function handleNext() {
    setError("");

    // Per the iSarita flow: commit any in-progress party before moving on
    // (same behaviour as the manual's "Update" button on this screen).
    const hasDraft = Object.values(form).some((v) => v !== "" && v !== null && v !== undefined);
    let savedCount = parties.length;

    if (hasDraft) {
      const saved = await handleAddOrUpdate(false);
      if (!saved) return; // validation/API error — stay on this screen
      savedCount += selectedPartyId ? 0 : 1;
    }

    if (savedCount === 0) {
      setError(t("party.mustAdd"));
      return;
    }
    navigate(`/entries/${id}/identifications`);
  }

  return (
    <div className="page-shell">
      <HeaderSarita />
      <div className="page-body entry-body">
        <h1 className="entry-title">{t("party.title")}</h1>
        <div className="entry-count entry-count-row">
          <label>{t("party.count")}</label>
          <input
            type="number"
            min={1}
            value={parties.length + (selectedPartyId ? 0 : 1)}
            readOnly
            aria-label={t("party.count")}
          />
        </div>

        {error && <div className="banner banner-error">{error}</div>}

        {/* Party Type & Entity Type — one row, 50% each, labels aligned with the grid */}
        <div className="party-half-row">
          <div className="party-half">
            <label>{t("party.selectPartyType")}</label>
            <select value={form.party_type} onChange={(e) => update("party_type", e.target.value)}>
              <option value="">{t("party.selectPartyTypeOption")}</option>
              {PARTY_TYPES.map((pt) => (
                <option key={pt} value={pt}>
                  {pt}
                </option>
              ))}
            </select>
          </div>
          <div className="party-half">
            <label>{t("party.entityType")}</label>
            <DropdownOrText
              value={form.entity_type}
              options={ENTITY_TYPES}
              placeholder={t("party.selectEntityTypeOption")}
              onChange={(v) => update("entity_type", v)}
            />
          </div>
        </div>

        <div className="entry-grid">
          <div className="section-heading">
            <span>{t("party.nameEnglish")}</span>
            <span>{t("party.nameMarathi")}</span>
          </div>

          {/* Salutation — English side only (no Marathi autocomplete), aligned
              with the label/field columns of the name rows below */}
          <div className="party-half-row salutation-row">
            <div className="party-half">
              <label>{t("party.salutation")}</label>
              <select value={form.salutation} onChange={(e) => update("salutation", e.target.value)}>
                <option value="">{t("party.selectSalutationOption")}</option>
                {SALUTATIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="party-half">
              <span />
            </div>
          </div>

          <div className="party-half-row">
            <div className="party-half">
              <label>{t("common:surname")}</label>
              <input value={form.surname_en} onChange={(e) => update("surname_en", e.target.value)} />
            </div>
            <div className="party-half">
              <label>{t("party.surnameMr")}</label>
              <input value={form.surname_mr} onChange={(e) => update("surname_mr", e.target.value)} />
            </div>
          </div>

          <div className="party-half-row">
            <div className="party-half">
              <label>{t("common:firstName")}</label>
              <input value={form.first_name_en} onChange={(e) => update("first_name_en", e.target.value)} />
            </div>
            <div className="party-half">
              <label>{t("party.firstNameMr")}</label>
              <input value={form.first_name_mr} onChange={(e) => update("first_name_mr", e.target.value)} />
            </div>
          </div>

          <div className="party-half-row">
            <div className="party-half">
              <label>{t("common:middleName")}</label>
              <input value={form.middle_name_en} onChange={(e) => update("middle_name_en", e.target.value)} />
            </div>
            <div className="party-half">
              <label>{t("party.middleNameMr")}</label>
              <input value={form.middle_name_mr} onChange={(e) => update("middle_name_mr", e.target.value)} />
            </div>
          </div>

          <div className="party-half-row">
            <div className="party-half party-half-nolabel">
              <div className="checkbox-row">
                <input type="checkbox" checked={form.is_stamp_purchaser} onChange={(e) => update("is_stamp_purchaser", e.target.checked)} /> {t("party.isStampPurchaser")}
              </div>
            </div>
            <div className="party-half party-half-nolabel">
              <div className="checkbox-row">
                <input type="checkbox" checked={form.is_presentor} onChange={(e) => update("is_presentor", e.target.checked)} /> {t("party.isPresentor")}
              </div>
            </div>
          </div>

          <div className="section-heading">
            <span>{t("party.personalInfo")}</span>
          </div>

          <div className="party-half-row">
            <div className="party-half">
              <label>{t("common:age")}</label>
              <input type="number" min="0" max="150" value={form.age} onChange={(e) => update("age", e.target.value)} />
            </div>
            <div className="party-half">
              <label>{t("party.occupation")}</label>
              <select value={form.occupation} onChange={(e) => update("occupation", e.target.value)}>
                <option value="">{t("party.selectOccupationOption")}</option>
                {OCCUPATIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="party-half-row">
            <div className="party-half">
              <label>{t("party.gender")}</label>
              <div className="checkbox-row" role="radiogroup" aria-label={t("party.gender")}>
                {GENDERS.map((g) => (
                  <label key={g} style={{ marginRight: "12px", whiteSpace: "nowrap" }}>
                    <input
                      type="radio"
                      name="gender"
                      value={g}
                      checked={form.gender === g}
                      onChange={(e) => update("gender", e.target.value)}
                    />{" "}
                    {g}
                  </label>
                ))}
              </div>
            </div>
            <div className="party-half party-half-nolabel">
              <span />
            </div>
          </div>

          <div className="section-heading">
            <span>{t("party.addrEnglish")}</span>
            <span>{t("party.addrMarathi")}</span>
          </div>

          <div className="party-half-row">
            <div className="party-half">
              <label>{t("property.flatNo")}</label>
              <input value={form.flat_no_en} onChange={(e) => update("flat_no_en", e.target.value)} />
            </div>
            <div className="party-half">
              <label>{t("property.flatNoMr")}</label>
              <input value={form.flat_no_mr} onChange={(e) => update("flat_no_mr", e.target.value)} />
            </div>
          </div>

          <div className="party-half-row">
            <div className="party-half">
              <label>{t("property.floorNo")}</label>
              <input value={form.floor_no_en} onChange={(e) => update("floor_no_en", e.target.value)} />
            </div>
            <div className="party-half">
              <label>{t("property.floorNoMr")}</label>
              <input value={form.floor_no_mr} onChange={(e) => update("floor_no_mr", e.target.value)} />
            </div>
          </div>

          <div className="party-half-row">
            <div className="party-half">
              <label>{t("property.buildingName")}</label>
              <input value={form.building_name_en} onChange={(e) => update("building_name_en", e.target.value)} />
            </div>
            <div className="party-half">
              <label>{t("property.buildingNameMr")}</label>
              <input value={form.building_name_mr} onChange={(e) => update("building_name_mr", e.target.value)} />
            </div>
          </div>

          <div className="party-half-row">
            <div className="party-half">
              <label>{t("property.blockSector")}</label>
              <input value={form.block_sector_en} onChange={(e) => update("block_sector_en", e.target.value)} />
            </div>
            <div className="party-half">
              <label>{t("property.blockSectorMr")}</label>
              <input value={form.block_sector_mr} onChange={(e) => update("block_sector_mr", e.target.value)} />
            </div>
          </div>

          <div className="party-half-row">
            <div className="party-half">
              <label>{t("property.road")}</label>
              <input value={form.road_en} onChange={(e) => update("road_en", e.target.value)} />
            </div>
            <div className="party-half">
              <label>{t("property.roadMr")}</label>
              <input value={form.road_mr} onChange={(e) => update("road_mr", e.target.value)} />
            </div>
          </div>

          <div className="party-half-row">
            <div className="party-half">
              <label>{t("party.pinCode")}</label>
              <input value={form.pin_code} maxLength={6} inputMode="numeric" onChange={(e) => update("pin_code", e.target.value)} />
            </div>
            <div className="party-half">
              <label>{t("party.country")}</label>
              <DropdownOrText
                value={form.country}
                options={COUNTRIES}
                placeholder="--Select Country--"
                onChange={(v) => update("country", v)}
              />
            </div>
          </div>

          <div className="party-half-row">
            <div className="party-half">
              <label>{t("party.state")}</label>
              <DropdownOrText
                value={form.state_en}
                options={INDIAN_STATES}
                placeholder="--Select State--"
                onChange={handleStateChange}
              />
            </div>
            <div className="party-half">
              <label>{t("party.stateMr")}</label>
              <input
                value={form.state_mr}
                onChange={(e) => update("state_mr", e.target.value)}
                placeholder="राज्य (मराठी)"
              />
            </div>
          </div>

          <div className="party-half-row">
            <div className="party-half">
              <label>{t("party.city")}</label>
              <DropdownOrText
                value={form.city_en}
                options={getCitiesFor(form.state_en)}
                placeholder="--Select City--"
                onChange={(v) => update("city_en", v)}
              />
            </div>
            <div className="party-half">
              <label>{t("party.cityMr")}</label>
              <input
                value={form.city_mr}
                onChange={(e) => update("city_mr", e.target.value)}
                placeholder="शहर (मराठी)"
              />
            </div>
          </div>

          <div className="party-half-row">
            <div className="party-half">
              <label>{t("party.districtName")}</label>
              <DropdownOrText
                value={form.district_name}
                options={MAHARASHTRA_DISTRICTS}
                placeholder="--Select District--"
                onChange={(v) => update("district_name", v)}
              />
            </div>
            <div className="party-half">
              <label>{t("party.districtMr")}</label>
              <input
                value={form.district_mr}
                onChange={(e) => update("district_mr", e.target.value)}
                placeholder="जिल्हा (मराठी)"
              />
            </div>
          </div>

          {/* Seller-side / Alias / ID Details section 
          <div className="section-heading">
            <span>Alias / Seller / Identification Details</span>
          </div>

          <label>Alias Name (Marathi)</label>
          <input value={form.alias_name_mr} onChange={(e) => update("alias_name_mr", e.target.value)} />
          <label>Alias Name (English)</label>
          <input value={form.alias_name_en} onChange={(e) => update("alias_name_en", e.target.value)} />

          <label>ID Type</label>
          <DropdownOrText
            value={form.id_type}
            options={ID_TYPES}
            placeholder="--Select ID Type--"
            onChange={(v) => update("id_type", v)}
          />
          <label>ID Number</label>
          <input value={form.id_no} onChange={(e) => update("id_no", e.target.value)} />

          <label>Full PAN Name</label>
          <input value={form.full_pan_name} onChange={(e) => update("full_pan_name", e.target.value)} />
          <label>Party Serial No.</label>
          <input value={form.party_sr_no || parties.length + 1} readOnly style={{ backgroundColor: "#edf2f7" }} />

          <label>Seller Khata No.</label>
          <input value={form.seller_khata_no} onChange={(e) => update("seller_khata_no", e.target.value)} />
          <label>Seller First Name</label>
          <input value={form.seller_first_name} onChange={(e) => update("seller_first_name", e.target.value)} />

          <label>Seller Middle Name</label>
          <input value={form.seller_middle_name} onChange={(e) => update("seller_middle_name", e.target.value)} />
          <label>Seller Last Name</label>
          <input value={form.seller_last_name} onChange={(e) => update("seller_last_name", e.target.value)} />
          */}
          {/* Land / Agricultural Details (rendered when Rural property linked) */}
          {isRural && (
            <>
              <div className="section-heading">
                <span>Land / Agricultural Details (Rural Property)</span>
              </div>

              <div className="party-half-row">
                <div className="party-half">
                  <label>Survey No.</label>
                  <input value={form.survey_no} onChange={(e) => update("survey_no", e.target.value)} />
                </div>
                <div className="party-half">
                  <label>Khata No.</label>
                  <input value={form.khata_no} onChange={(e) => update("khata_no", e.target.value)} />
                </div>
              </div>

              <div className="party-half-row">
                <div className="party-half">
                  <label>Party Area</label>
                  <input type="number" step="0.01" value={form.party_area} onChange={(e) => update("party_area", e.target.value)} />
                </div>
                <div className="party-half">
                  <label>Vikri Area (Sale Area)</label>
                  <input type="number" step="0.01" value={form.vikri_area} onChange={(e) => update("vikri_area", e.target.value)} />
                </div>
              </div>

              <div className="party-half-row">
                <div className="party-half">
                  <label>Potkharaba Area</label>
                  <input type="number" step="0.01" value={form.potkharaba_area} onChange={(e) => update("potkharaba_area", e.target.value)} />
                </div>
                <div className="party-half">
                  <label>Potkharaba Vikri Area</label>
                  <input type="number" step="0.01" value={form.potkharaba_vikri_area} onChange={(e) => update("potkharaba_vikri_area", e.target.value)} />
                </div>
              </div>
            </>
          )}

          <div className="section-heading">
            <span>Identity Verification & Documents</span>
          </div>

          <div className="party-half-row">
            <div className="party-half">
              <label>{t("party.uid")}</label>
              <input value={form.uid} onChange={(e) => update("uid", e.target.value)} />
            </div>
            <div className="party-half">
              <label>{t("party.mobileNumber")}</label>
              <div className="verify-btn-row">
                <input value={form.mobile_number} maxLength={10} inputMode="numeric" onChange={(e) => update("mobile_number", e.target.value)} />
                <button type="button" className="btn btn-green" onClick={verifyMobile}>
                  {t("party.verify")}
                </button>
                {(mobileStatus === true || form.mobile_number_verified) && <span className="verify-ok">✔ Verified</span>}
                {mobileStatus === false && <span className="verify-fail">✘ Failed</span>}
              </div>
            </div>
          </div>

          <div className="party-half-row">
            <div className="party-half">
              <label>{t("party.idMark1")}</label>
              <input value={form.identification_mark1} onChange={(e) => update("identification_mark1", e.target.value)} />
            </div>
            <div className="party-half">
              <label>{t("party.idMark2")}</label>
              <input value={form.identification_mark2} onChange={(e) => update("identification_mark2", e.target.value)} />
            </div>
          </div>

          <div className="section-heading">
            <span>{t("party.panDetails")}</span>
          </div>
          <div className="banner banner-error" style={{ gridColumn: "1 / -1" }}>
            {t("party.panWarning")}
          </div>
          <div className="banner" style={{ gridColumn: "1 / -1" }}>
            {t("party.panInfo")}
          </div>

          <div className="party-half-row">
            <div className="party-half">
              <label>{t("party.dob")}</label>
              <input type="date" value={form.date_of_birth} onChange={(e) => update("date_of_birth", e.target.value)} />
            </div>
            <div className="party-half">
              <label>{t("party.panCardNo")}</label>
              <div className="verify-btn-row">
                <input
                  value={form.pan_number}
                  maxLength={10}
                  style={{ textTransform: "uppercase" }}
                  onChange={(e) => update("pan_number", e.target.value.toUpperCase())}
                />
                <button type="button" className="btn btn-green" onClick={verifyPan}>
                  {t("party.verifyPan")}
                </button>
                {panStatus === true && <span className="verify-ok">{t("common:verified")}</span>}
                {panStatus === false && <span className="verify-fail">{t("common:notVerified")}</span>}
              </div>
            </div>
          </div>

          <div className="party-half-row">
            <div className="party-half party-half-nolabel">
              <div>
                <a href="#" className="pd-link-btn" onClick={(e) => e.preventDefault()}>
                  {t("party.aboutPanVerify")}
                </a>
              </div>
            </div>
            <div className="party-half party-half-nolabel">
              <div className="checkbox-row">
                <input type="checkbox" checked={form.declaration_form_60_61} onChange={(e) => update("declaration_form_60_61", e.target.checked)} />
                {t("party.declaration60_61")}
              </div>
            </div>
          </div>

          <div className="party-half-row">
            <div className="party-half">
              <label>{t("party.identificationProof")}</label>
              <select value={form.identification_proof} onChange={(e) => update("identification_proof", e.target.value)}>
                {ID_PROOFS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="party-half">
              <label>{t("party.proofNo")}</label>
              <input value={form.identification_proof_number} onChange={(e) => update("identification_proof_number", e.target.value)} />
            </div>
          </div>

          <div className="party-half-row">
            <div className="party-half">
              <label>{t("party.email")}</label>
              <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            </div>
            <div className="party-half party-half-nolabel">
              <span />
            </div>
          </div>

          {/* Execution By (spec §18) — radio group, Self by default */}
          <div className="section-heading">
            <span>{t("party.executionBy")}</span>
          </div>
          <div className="party-half-row">
            <div className="party-half party-half-nolabel">
              <div className="checkbox-row" role="radiogroup" aria-label={t("party.executionBy")}>
                {EXECUTION_BY_OPTIONS.map((opt) => (
                  <label key={opt.value} style={{ marginRight: "16px", whiteSpace: "nowrap" }}>
                    <input
                      type="radio"
                      name="execution_by"
                      value={opt.value}
                      checked={form.execution_by === opt.value}
                      onChange={(e) => update("execution_by", e.target.value)}
                    />{" "}
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="party-half party-half-nolabel">
              <span />
            </div>
          </div>

          {/* Applicable Options (spec §33) — red centred instruction + checkboxes */}
          <div className="section-heading" style={{ gridColumn: "1 / -1", color: "#c0392b", textAlign: "center", fontWeight: "bold" }}>
            <span>{t("party.tickApplicable")}</span>
          </div>
          <div className="party-half-row">
            <div className="party-half party-half-nolabel">
              <div className="checkbox-row">
                <input type="checkbox" checked={form.is_document_signed} onChange={(e) => update("is_document_signed", e.target.checked)} /> {t("party.isDocumentSigned")}
              </div>
            </div>
            <div className="party-half party-half-nolabel">
              <div className="checkbox-row">
                <input type="checkbox" checked={form.is_exemption_section_88} onChange={(e) => update("is_exemption_section_88", e.target.checked)} /> {t("party.isExemption88")}
              </div>
            </div>
          </div>
          <div className="party-half-row">
            <div className="party-half party-half-nolabel">
              <div className="checkbox-row">
                <input type="checkbox" checked={form.uid_consent_aadhaar} onChange={(e) => update("uid_consent_aadhaar", e.target.checked)} /> {t("party.uidConsent")}
              </div>
            </div>
            <div className="party-half party-half-nolabel">
              <span />
            </div>
          </div>
        </div>

        <div className="entry-actions">
          <button type="button" className="btn btn-blue" onClick={() => navigate(`/entries/${id}/properties`)} disabled={saving}>
            {t("party.prevParty")}
          </button>
          <button type="button" className="btn btn-green" onClick={() => handleAddOrUpdate(true)} disabled={saving}>
            {t("party.addParty")}
          </button>
          <button type="button" className="btn btn-green" onClick={() => handleAddOrUpdate(false)} disabled={saving}>
            {saving ? t("common:saving") : t("party.saveParty")}
          </button>
          <button type="button" className="btn btn-green" onClick={handleNext}>
            {t("party.nextParty")}
          </button>
        </div>

        <div className="step-table-title">{t("party.tableTitle")}</div>
        <div style={{ overflowX: "auto", width: "100%", border: "1px solid #cbd5e0", borderRadius: "4px" }}>
          <table className="step-table" style={{ whiteSpace: "nowrap" }}>
            <thead>
              <tr>
                <th>Select</th>
                <th>Delete</th>
                <th>Party Type</th>
                <th>Entity Type</th>
                <th>LName</th>
                <th>FName</th>
                <th>MName</th>
                <th>Age</th>
                <th>Add</th>
                <th>PinCode</th>
                <th>PANNo</th>
                <th>Sign</th>
                <th>Exemption</th>
                <th>UID Consent</th>
                <th>BankOfficer</th>
                <th>Declaration</th>
                <th>PartySRNO</th>
                <th>Eng Lname</th>
                <th>Eng Fname</th>
                <th>Eng Mname</th>
                <th>Eng Address</th>
                <th>IDTYPE</th>
                <th>ID NO.</th>
                <th>Full PAN Name</th>
                <th>Alias Name</th>
                <th>Alias Name Eng</th>
                <th>Survey</th>
                <th>Khata No</th>
                <th>Party Area</th>
                <th>Vikri Area</th>
                <th>Potkharaba Area</th>
                <th>Potkharaba Vikri Area</th>
                <th>Seller Khata No</th>
                <th>Seller FName</th>
                <th>Seller MName</th>
                <th>Seller LName</th>
                <th>Mobile No.</th>
                <th>Mobile No. Verified</th>
                <th>IsPANVerified</th>
              </tr>
            </thead>
            <tbody>
              {parties.length === 0 && (
                <tr>
                  <td colSpan={39} style={{ textAlign: "center", color: "#777", padding: "16px" }}>
                    {t("party.noRows")}
                  </td>
                </tr>
              )}
              {parties.map((p, idx) => (
                <tr key={p.id || idx}>
                  <td>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handleSelectRow(p);
                      }}
                    >
                      Select
                    </a>
                  </td>
                  <td>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handleDelete(p.id);
                      }}
                    >
                      Delete
                    </a>
                  </td>
                  <td>{p.party_type || "—"}</td>
                  <td>{p.entity_type || "—"}</td>
                  <td>{p.surname_mr || p.surname_en || "—"}</td>
                  <td>{p.first_name_mr || p.first_name_en || "—"}</td>
                  <td>{p.middle_name_mr || p.middle_name_en || "—"}</td>
                  <td>{p.age ?? "—"}</td>
                  <td>{p.address_combined || "—"}</td>
                  <td>{p.pin_code || "—"}</td>
                  <td>{p.pan_number || "—"}</td>
                  <td>{p.is_document_signed ? "Yes" : "No"}</td>
                  <td>{p.is_exemption_section_88 ? "Yes" : "No"}</td>
                  <td>{p.uid_consent_aadhaar ? "Yes" : "No"}</td>
                  <td>{p.is_bank ? "Yes" : "No"}</td>
                  <td>{p.declaration_form_60_61 ? "Yes" : "No"}</td>
                  <td>{p.party_sr_no || idx + 1}</td>
                  <td>{p.surname_en || "—"}</td>
                  <td>{p.first_name_en || "—"}</td>
                  <td>{p.middle_name_en || "—"}</td>
                  <td>{p.address_combined || "—"}</td>
                  <td>{p.id_type || "P"}</td>
                  <td>{p.id_no || p.pan_number || "—"}</td>
                  <td>{p.full_pan_name || `${p.first_name_en || ""} ${p.surname_en || ""}`}</td>
                  <td>{p.alias_name_mr || "—"}</td>
                  <td>{p.alias_name_en || "—"}</td>
                  <td>{p.survey_no || "0"}</td>
                  <td>{p.khata_no || "0"}</td>
                  <td>{p.party_area !== null && p.party_area !== undefined ? p.party_area : "0.0"}</td>
                  <td>{p.vikri_area !== null && p.vikri_area !== undefined ? p.vikri_area : "0.0"}</td>
                  <td>{p.potkharaba_area !== null && p.potkharaba_area !== undefined ? p.potkharaba_area : "0.0"}</td>
                  <td>{p.potkharaba_vikri_area !== null && p.potkharaba_vikri_area !== undefined ? p.potkharaba_vikri_area : "0.0"}</td>
                  <td>{p.seller_khata_no || "—"}</td>
                  <td>{p.seller_first_name || "—"}</td>
                  <td>{p.seller_middle_name || "—"}</td>
                  <td>{p.seller_last_name || "—"}</td>
                  <td>{p.mobile_number || "—"}</td>
                  <td>{p.mobile_number_verified ? "Yes" : "No"}</td>
                  <td>{p.pan_verified ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Transaction metadata (spec §40) — read-only */}
        <div className="step-table-title">{t("party.metaTitle")}</div>
        <div className="party-half-row">
          <div className="party-half">
            <label>{t("party.tokenNo")}</label>
            <input value={docMeta?.token_number || ""} readOnly />
          </div>
          <div className="party-half">
            <label>{t("party.dig")}</label>
            <input value={docMeta?.dig_name || ""} readOnly />
          </div>
        </div>
        <div className="party-half-row">
          <div className="party-half">
            <label>{t("party.jdr")}</label>
            <input value={docMeta?.jdr_name || ""} readOnly />
          </div>
          <div className="party-half">
            <label>{t("party.sro")}</label>
            <input value={docMeta?.office_name || ""} readOnly />
          </div>
        </div>
      </div>
      <Footer office={{ dig: "Pune", jdr: "Pune", sro: "Joint S.R. Haveli 14" }} />
    </div>
  );
}
