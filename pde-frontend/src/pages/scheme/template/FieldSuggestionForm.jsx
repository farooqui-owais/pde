import React from "react";

const SUGGESTED_CLAUSES = [
  {
    title: "Standard Sale Consideration Clause",
    content: `<p><strong>1. CONSIDERATION:</strong> In consideration of the sum of <strong>{{document.consideration_amount}}</strong> paid by the Purchaser to the Promoter/Seller, the Seller hereby sells and transfers all rights, title and interest in <strong>{{property.flat_number}}</strong> in <strong>{{scheme.scheme_name}}</strong>.</p>`,
  },
  {
    title: "Possession & Handover Clause",
    content: `<p><strong>2. POSSESSION:</strong> The Promoter/Seller confirms that possession of <strong>{{property.flat_number}}</strong> with Carpet Area of <strong>{{property.carpet_area}}</strong> having MahaRERA Reg No <strong>{{scheme.maha_rera_number}}</strong> is handed over to the Purchaser with complete occupancy clearance.</p>`,
  },
  {
    title: "Title & Encumbrance Declaration",
    content: `<p><strong>3. TITLE DECLARATION:</strong> The Seller certifies that the land bearing Survey No <strong>{{property.survey_number}}</strong>, Village <strong>{{project.village}}</strong> is free from all encumbrances, liens, or court litigation as per Title Certificate.</p>`,
  },
  {
    title: "Stamp Duty & Registration Fee Responsibility",
    content: `<p><strong>4. STAMP DUTY & CHARGES:</strong> The total stamp duty amounting to <strong>{{document.stamp_duty}}</strong> and applicable registration charges shall be borne exclusively by the Purchaser.</p>`,
  },
];

export default function FieldSuggestionForm({ onInsertClause }) {
  return (
    <div className="field-suggestion-box">
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
        Suggested Deed Clauses
      </h4>
      <div className="suggested-clauses-list">
        {SUGGESTED_CLAUSES.map((c, idx) => (
          <div key={idx} className="suggested-clause-item">
            <div className="text-xs font-semibold text-sky-800">{c.title}</div>
            <button
              type="button"
              className="btn btn-secondary btn-xs mt-1"
              onClick={() => onInsertClause(c.content)}
            >
              + Insert Clause
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
