import React, { useState } from "react";

export default function TemplateFieldsForm({ fieldGroups, onChange }) {
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldKey, setNewFieldKey] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");

  const handleAddField = (e) => {
    e.preventDefault();
    if (!newFieldName || !newFieldKey) {
      alert("Field Name and Token Key are required.");
      return;
    }

    const fieldObj = {
      name: newFieldName,
      key: newFieldKey.startsWith("custom.") ? newFieldKey : `custom.${newFieldKey}`,
      type: newFieldType,
    };

    const updated = [...(fieldGroups || []), fieldObj];
    onChange(updated);
    setNewFieldName("");
    setNewFieldKey("");
  };

  const handleRemoveField = (idx) => {
    const updated = (fieldGroups || []).filter((_, i) => i !== idx);
    onChange(updated);
  };

  return (
    <div className="template-fields-form">
      <h4 className="text-sm font-bold text-slate-700 mb-2">Custom Template Variables</h4>
      <p className="text-xs text-muted mb-3">
        Define additional custom parameters that can be merged into this deed template during execution.
      </p>

      <form className="flex gap-2 mb-3" onSubmit={handleAddField}>
        <input
          type="text"
          className="scheme-input text-xs"
          placeholder="Display Label (e.g. Parking Number)"
          value={newFieldName}
          onChange={(e) => setNewFieldName(e.target.value)}
        />
        <input
          type="text"
          className="scheme-input text-xs"
          placeholder="Token Key (e.g. parking_no)"
          value={newFieldKey}
          onChange={(e) => setNewFieldKey(e.target.value)}
        />
        <select
          className="scheme-select text-xs"
          style={{ width: "110px" }}
          value={newFieldType}
          onChange={(e) => setNewFieldType(e.target.value)}
        >
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="date">Date</option>
        </select>
        <button type="submit" className="btn btn-secondary btn-xs">
          + Add
        </button>
      </form>

      {fieldGroups && fieldGroups.length > 0 && (
        <div className="custom-fields-list">
          {fieldGroups.map((f, idx) => (
            <div key={idx} className="custom-field-tag">
              <span>
                <strong>{f.name}</strong> (<code>&#123;&#123;{f.key}&#125;&#125;</code>)
              </span>
              <button
                type="button"
                className="custom-field-remove"
                onClick={() => handleRemoveField(idx)}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
