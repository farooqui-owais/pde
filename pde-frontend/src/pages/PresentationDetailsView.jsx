import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios.js";
import HeaderSarita from "../components/HeaderSarita.jsx";
import Footer from "../components/Footer.jsx";
import "./PresentationDetailsView.css";

const DASH = "\u2014";

function fmtDate(d) {
  if (!d) return DASH;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? DASH : dt.toLocaleDateString("en-GB");
}

function fmtAmount(v) {
  if (v === null || v === undefined || v === "") return DASH;
  return `\u20B9 ${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** A bordered section with a heading and a label/value (or EN/MR) table body. */
function Section({ title, children }) {
  return (
    <section className="pdv-section">
      <h2 className="pdv-section-title">{title}</h2>
      <div className="pdv-section-body">{children}</div>
    </section>
  );
}

/** Simple label/value row. */
function Row({ label, value }) {
  return (
    <tr>
      <th className="pdv-label">{label}</th>
      <td className="pdv-value">{value ?? DASH}</td>
    </tr>
  );
}

/** Field row with paired English / Marathi values. */
function RowBilingual({ label, en, mr }) {
  return (
    <tr>
      <th className="pdv-label">{label}</th>
      <td className="pdv-value">{en || DASH}</td>
      <td className="pdv-value pdv-mr">{mr || DASH}</td>
    </tr>
  );
}

function BilingualHeader() {
  const { t } = useTranslation(["pages"]);
  return (
    <thead>
      <tr>
        <th className="pdv-label">{t("detailsView.field")}</th>
        <th>{t("detailsView.english")}</th>
        <th>{t("detailsView.marathi")}</th>
      </tr>
    </thead>
  );
}

function EmptyNote({ text }) {
  return <div className="pdv-empty">{text}</div>;
}

export default function PresentationDetailsView() {
  const { t } = useTranslation(["pages", "common"]);
  const { id } = useParams();
  const navigate = useNavigate();

  const [doc, setDoc] = useState(null);
  const [payments, setPayments] = useState([]);
  const [properties, setProperties] = useState([]);
  const [parties, setParties] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get(`/api/documents/${id}`),
      api.get(`/api/stamp/payments/${id}`).catch(() => ({ data: [] })),
      api.get(`/api/documents/${id}/properties`).catch(() => ({ data: [] })),
      api.get(`/api/documents/${id}/parties`).catch(() => ({ data: [] })),
    ])
      .then(([d, p, pr, pa]) => {
        if (cancelled) return;
        setDoc(d.data);
        setPayments(Array.isArray(p.data) ? p.data : []);
        setProperties(Array.isArray(pr.data) ? pr.data : []);
        setParties(Array.isArray(pa.data) ? pa.data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.detail || t("detailsView.couldNotLoad"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, t]);

  if (loading) {
    return (
      <div className="page-shell">
        <HeaderSarita />
        <div className="page-body entry-body">{t("detailsView.loading")}</div>
      </div>
    );
  }

  if (error && !doc) {
    return (
      <div className="page-shell">
        <HeaderSarita />
        <div className="page-body entry-body">
          <div className="banner banner-error">{error}</div>
        </div>
        <Footer />
      </div>
    );
  }

  // ---- Presentation Details (only fields that exist in the data model) ----
  const presentationRows = [
    [t("detailsView.articleNumber"), doc?.article_type_id],
    [t("detailsView.articleName"), doc?.article_type_name],
    [t("detailsView.articleDescription"), doc?.article_type_description],
    [t("detailsView.documentTitle"), doc?.document_title],
    [t("detailsView.presenterType"), doc?.presenter_type],
    [t("detailsView.valuation"), doc?.valuation_text],
    [t("detailsView.noValuationReason"), doc?.no_valuation_reason],
    [t("detailsView.documentExecutedIn"), doc?.document_executed_in],
    [t("detailsView.marketValue"), fmtAmount(doc?.market_value)],
    [t("detailsView.considerationAmount"), fmtAmount(doc?.consideration_amount)],
    [t("detailsView.stampDuty"), fmtAmount(doc?.stamp_duty)],
    [t("detailsView.stampDutyPaid"), fmtAmount(doc?.stamp_duty_paid)],
    [t("detailsView.stampDutyDifference"), fmtAmount(doc?.stamp_duty_difference)],
    [t("detailsView.dateOfExecution"), fmtDate(doc?.date_of_execution)],
    [t("detailsView.dateOfPresentation"), fmtDate(doc?.date_of_presentation)],
    [t("detailsView.numberOfPages"), doc?.number_of_pages],
    [t("detailsView.tokenNumber"), doc?.token_number],
    [t("detailsView.district"), doc?.district_name],
    [t("detailsView.office"), doc?.office_name],
  ];

  // ---- Payment reference number: combine the applicable instrument numbers ----
  const paymentRef = (p) =>
    [p.franking_mc_no, p.franking_serial_no, p.licence_no, p.serial_no, p.stationery_number]
      .filter(Boolean)
      .join(", ") || DASH;

  return (
    <div className="page-shell">
      <HeaderSarita />
      <div className="page-body entry-body">
        <h1 className="entry-title">{t("detailsView.title")}</h1>
        {error && <div className="banner banner-error">{error}</div>}

        {/* 1. Presentation Details */}
        <Section title={t("detailsView.presentationSection")}>
          <table className="pdv-table">
            <tbody>
              {presentationRows.map(([label, value]) => (
                <Row key={label} label={label} value={value} />
              ))}
            </tbody>
          </table>
        </Section>

        {/* 2. Payment Details — one row per saved payment record */}
        <Section title={t("detailsView.paymentSection")}>
          {payments.length === 0 ? (
            <EmptyNote text={t("detailsView.noPayments")} />
          ) : (
            <table className="pdv-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t("detailsView.payType")}</th>
                  <th>{t("detailsView.payNumber")}</th>
                  <th>{t("detailsView.payDate")}</th>
                  <th>{t("detailsView.payAmount")}</th>
                  <th>{t("detailsView.payVendorsName")}</th>
                  <th>{t("detailsView.payVendorsPlace")}</th>
                  <th>{t("detailsView.payVendorsLicence")}</th>
                  <th>{t("detailsView.payPurchasersName")}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={p.id}>
                    <td>{i + 1}</td>
                    <td>{p.paid_by || DASH}</td>
                    <td>{paymentRef(p)}</td>
                    <td>{fmtDate(p.payment_date)}</td>
                    <td>{fmtAmount(p.amount)}</td>
                    <td>{p.vendors_name || DASH}</td>
                    <td>{p.vendors_place || DASH}</td>
                    <td>{p.vendors_licence_no || DASH}</td>
                    <td>{p.purchasers_name || p.epurchasers_name || DASH}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* 3. Property Details — location + bilingual address tables per property */}
        <Section title={t("detailsView.propertySection")}>
          {properties.length === 0 ? (
            <EmptyNote text={t("detailsView.noProperties")} />
          ) : (
            properties.map((prop, idx) => (
              <div className="pdv-subblock" key={prop.id}>
                <h3 className="pdv-subtitle">
                  {t("detailsView.propertyN", { n: idx + 1 })}
                  {prop.property_code ? ` \u2014 ${prop.property_code}` : ""}
                </h3>
                <table className="pdv-table">
                  <tbody>
                    <Row label={t("detailsView.villageName")} value={prop.village_name} />
                    <Row label={t("detailsView.districtName")} value={prop.district} />
                    <Row label={t("detailsView.urbanRural")} value={prop.urban_rural} />
                    <Row label={t("detailsView.taluka")} value={prop.taluka} />
                    <Row label={t("detailsView.zp")} value={prop.zp} />
                    <Row
                      label={t("detailsView.hadd")}
                      value={prop.hadd_type ? `${prop.hadd_type}${prop.hadd_name ? ` \u2014 ${prop.hadd_name}` : ""}` : prop.hadd_name}
                    />
                    <Row
                      label={t("detailsView.attributes")}
                      value={prop.attributes?.length ? prop.attributes.map((a) => `${a.type}: ${a.value}`).join(", ") : DASH}
                    />
                    <Row
                      label={t("detailsView.area")}
                      value={prop.area != null ? `${prop.area} ${prop.area_unit || ""}`.trim() : DASH}
                    />
                    <Row label={t("detailsView.propertyType")} value={prop.property_type} />
                    <Row label={t("detailsView.puiNumber")} value={prop.pui_number} />
                  </tbody>
                </table>

                <h4 className="pdv-mini-title">{t("detailsView.addressInfo")}</h4>
                <table className="pdv-table pdv-bilingual">
                  <BilingualHeader />
                  <tbody>
                    <RowBilingual label={t("detailsView.flatNo")} en={prop.flat_no_en} mr={prop.flat_no_mr} />
                    <RowBilingual label={t("detailsView.floorNo")} en={prop.floor_no_en} mr={prop.floor_no_mr} />
                    <RowBilingual label={t("detailsView.buildingName")} en={prop.building_name_en} mr={prop.building_name_mr} />
                    <RowBilingual label={t("detailsView.blockSector")} en={prop.block_sector_en} mr={prop.block_sector_mr} />
                    <RowBilingual label={t("detailsView.road")} en={prop.road_en} mr={prop.road_mr} />
                    <RowBilingual label={t("detailsView.otherDetails")} en={prop.eother_desc} mr={prop.other_desc} />
                    <RowBilingual label={t("detailsView.otherRight")} en={prop.other_right_en} mr={prop.other_right_mr} />
                  </tbody>
                </table>
              </div>
            ))
          )}
        </Section>

        {/* 4. Other Details */}
        <Section title={t("detailsView.otherSection")}>
          <table className="pdv-table">
            <tbody>
              <Row label={t("detailsView.entryStatus")} value={doc?.status} />
              <Row
                label={t("detailsView.puiVerified")}
                value={properties.some((p) => p.pui_verified) ? t("detailsView.yes") : t("detailsView.no")}
              />
              <Row
                label={t("detailsView.panVerified")}
                value={parties.some((p) => p.pan_verified) ? t("detailsView.yes") : t("detailsView.no")}
              />
              <Row
                label={t("detailsView.mobileVerified")}
                value={parties.some((p) => p.mobile_number_verified) ? t("detailsView.yes") : t("detailsView.no")}
              />
            </tbody>
          </table>
        </Section>

        {/* 5. Party Details — Party Details 1, 2, ... dynamically per saved party */}
        <Section title={t("detailsView.partySection")}>
          {parties.length === 0 ? (
            <EmptyNote text={t("detailsView.noParties")} />
          ) : (
            parties.map((party, idx) => {
              const nameEn = [party.first_name_en, party.middle_name_en, party.surname_en].filter(Boolean).join(" ");
              const nameMr = [party.first_name_mr, party.middle_name_mr, party.surname_mr].filter(Boolean).join(" ");
              const flags = [
                party.is_bank && t("detailsView.flagBank"),
                party.is_stamp_purchaser && t("detailsView.flagStampPurchaser"),
                party.is_presentor && t("detailsView.flagPresenter"),
              ]
                .filter(Boolean)
                .join(", ");
              return (
                <div className="pdv-subblock" key={party.id}>
                  <h3 className="pdv-subtitle">{t("detailsView.partyN", { n: idx + 1 })}</h3>
                  <table className="pdv-table">
                    <tbody>
                      <Row label={t("detailsView.partyType")} value={[party.party_type, flags].filter(Boolean).join(" \u2014 ")} />
                      <Row label={t("detailsView.entityType")} value={party.entity_type} />
                    </tbody>
                  </table>

                  <h4 className="pdv-mini-title">{t("detailsView.partyNameAddress")}</h4>
                  <table className="pdv-table pdv-bilingual">
                    <BilingualHeader />
                    <tbody>
                      <RowBilingual label={t("detailsView.fullName")} en={nameEn} mr={nameMr} />
                      <RowBilingual label={t("detailsView.flatNo")} en={party.flat_no_en} mr={party.flat_no_mr} />
                      <RowBilingual label={t("detailsView.floorNo")} en={party.floor_no_en} mr={party.floor_no_mr} />
                      <RowBilingual label={t("detailsView.buildingName")} en={party.building_name_en} mr={party.building_name_mr} />
                      <RowBilingual label={t("detailsView.blockSector")} en={party.block_sector_en} mr={party.block_sector_mr} />
                      <RowBilingual label={t("detailsView.road")} en={party.road_en} mr={party.road_mr} />
                      <RowBilingual label={t("detailsView.city")} en={party.city_en} mr={party.city_mr} />
                      <RowBilingual label={t("detailsView.state")} en={party.state_en} mr={party.state_mr} />
                    </tbody>
                  </table>

                  <table className="pdv-table">
                    <tbody>
                      <Row label={t("detailsView.age")} value={party.age} />
                      <Row label={t("detailsView.pinCode")} value={party.pin_code} />
                      <Row label={t("detailsView.districtName")} value={party.district_name} />
                      <Row label={t("detailsView.country")} value={party.country} />
                      <Row label={t("detailsView.mobileNumber")} value={party.mobile_number} />
                      <Row label={t("detailsView.panNumber")} value={party.pan_number} />
                      <Row label={t("detailsView.uid")} value={party.uid} />
                      <Row
                        label={t("detailsView.identificationMark")}
                        value={[party.identification_mark1, party.identification_mark2].filter(Boolean).join("; ")}
                      />
                      <Row
                        label={t("detailsView.identificationProof")}
                        value={[party.identification_proof, party.identification_proof_number].filter(Boolean).join(" \u2014 ")}
                      />
                      <Row
                        label={t("detailsView.form6061")}
                        value={party.declaration_form_60_61 ? t("detailsView.yes") : t("detailsView.no")}
                      />
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </Section>

        <div className="entry-actions">
          <button type="button" className="btn btn-blue" onClick={() => navigate(-1)}>
            {t("common:previous")}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => window.print()}>
            {t("common:print")}
          </button>
        </div>

      </div>
      <Footer />
    </div>
  );
}

