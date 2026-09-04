import React from "react";

const CUSTOM = "__custom__";

/**
 * Reusable "dropdown or free-text" control used across the entry forms for
 * reference fields (country, state, city, entity type, ID type, ...).
 *
 * Renders a <select> populated from `options`, plus an "Other / इतर (type it)"
 * entry point. When the value is not one of the options (for example a legacy
 * value or a typed "Other"), it switches to a text input so a valid value is
 * never blocked. If `options` is empty the control degrades to plain text.
 */
export default function DropdownOrText({ value, options = [], placeholder, onChange, className = "" }) {
  const noOptions = options.length === 0;
  const isCustom = noOptions || value === CUSTOM || (value && !options.includes(value));

  if (isCustom) {
    return (
      <div className={className}>
        <div className="pd-custom-row">
          <input
            value={value === CUSTOM ? "" : value}
            placeholder={noOptions ? placeholder : "Other / इतर (type it)…"}
            onChange={(e) => onChange(e.target.value)}
          />
          {!noOptions && (
            <button type="button" className="pd-link-btn" onClick={() => onChange("")}>
              Choose from list
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <select value={value} onChange={(e) => onChange(e.target.value === "other" ? CUSTOM : e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value="other">Other / इतर (type it)</option>
      </select>
    </div>
  );
}