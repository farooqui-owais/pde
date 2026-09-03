import React, { useState } from "react";

const FIELD_GROUPS = [
  {
    group: "Project & Scheme",
    fields: [
      { label: "Project Name", token: "{{project.project_name}}" },
      { label: "Scheme Name", token: "{{scheme.scheme_name}}" },
      { label: "Scheme Number", token: "{{scheme.scheme_number}}" },
      { label: "MahaRERA Number", token: "{{scheme.maha_rera_number}}" },
      { label: "Project Area", token: "{{scheme.project_area}}" },
      { label: "District", token: "{{project.district}}" },
      { label: "Taluka", token: "{{project.taluka}}" },
      { label: "Village", token: "{{project.village}}" },
    ],
  },
  {
    group: "Property Details",
    fields: [
      { label: "Flat / Unit Number", token: "{{property.flat_number}}" },
      { label: "Floor Number", token: "{{property.floor_number}}" },
      { label: "Building / Wing", token: "{{property.building_name}}" },
      { label: "Built-up Area", token: "{{property.built_up_area}}" },
      { label: "Carpet Area", token: "{{property.carpet_area}}" },
      { label: "Survey / CTS Number", token: "{{property.survey_number}}" },
      { label: "Boundaries (North/South/East/West)", token: "{{property.boundaries}}" },
      { label: "Property Address", token: "{{property.address}}" },
    ],
  },
  {
    group: "Seller / Developer",
    fields: [
      { label: "Seller Full Name", token: "{{seller.name}}" },
      { label: "Seller Category", token: "{{seller.category}}" },
      { label: "Seller PAN", token: "{{seller.pan}}" },
      { label: "Seller Address", token: "{{seller.address}}" },
      { label: "Company Registration", token: "{{seller.registration_number}}" },
      { label: "POA Holder Name", token: "{{seller.poa_holder_name}}" },
    ],
  },
  {
    group: "Purchaser / Buyer",
    fields: [
      { label: "Purchaser Full Name", token: "{{party.full_name}}" },
      { label: "Purchaser First Name", token: "{{party.first_name}}" },
      { label: "Purchaser Last Name", token: "{{party.last_name}}" },
      { label: "Purchaser PAN", token: "{{party.pan}}" },
      { label: "Purchaser Aadhaar (Masked)", token: "{{party.aadhaar}}" },
      { label: "Purchaser Address", token: "{{party.address}}" },
      { label: "Purchaser Mobile", token: "{{party.mobile}}" },
    ],
  },
  {
    group: "Document & Consideration",
    fields: [
      { label: "Consideration Amount (Rs.)", token: "{{document.consideration_amount}}" },
      { label: "Consideration in Words", token: "{{document.consideration_words}}" },
      { label: "Market Value", token: "{{document.market_value}}" },
      { label: "Stamp Duty Amount", token: "{{document.stamp_duty}}" },
      { label: "Registration Fee", token: "{{document.registration_fee}}" },
      { label: "Date of Execution", token: "{{document.execution_date}}" },
      { label: "Identifier Name", token: "{{identifier.name}}" },
    ],
  },
];

export default function TemplateFieldGroupsMenu({ onInsertToken }) {
  const [activeGroup, setActiveGroup] = useState(0);

  return (
    <div className="template-fields-menu">
      <div className="menu-header">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Insert Dynamic Tokens
        </h4>
      </div>

      <div className="menu-group-tabs">
        {FIELD_GROUPS.map((g, idx) => (
          <button
            key={g.group}
            type="button"
            className={`group-tab-btn ${activeGroup === idx ? "group-tab-active" : ""}`}
            onClick={() => setActiveGroup(idx)}
          >
            {g.group}
          </button>
        ))}
      </div>

      <div className="menu-tokens-list">
        {FIELD_GROUPS[activeGroup].fields.map((f) => (
          <button
            key={f.token}
            type="button"
            className="token-chip-btn"
            title={`Insert ${f.token}`}
            onClick={() => onInsertToken(f.token)}
          >
            <span className="token-label">{f.label}</span>
            <code className="token-code">{f.token}</code>
          </button>
        ))}
      </div>
    </div>
  );
}
