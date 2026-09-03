import React, { useRef } from "react";

export default function DeedDocumentEditor({ value, onChange, onInsertTokenRef }) {
  const textareaRef = useRef(null);

  const insertAtCursor = (text) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = value.substring(0, start);
    const after = value.substring(end, value.length);

    const newValue = before + text + after;
    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 10);
  };

  // Expose insertion method to parent
  if (onInsertTokenRef) {
    onInsertTokenRef.current = insertAtCursor;
  }

  const handleFormat = (tag) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.substring(start, end) || "Text";
    const formatted = `<${tag}>${selected}</${tag}>`;
    insertAtCursor(formatted);
  };

  return (
    <div className="deed-editor-container">
      <div className="editor-toolbar">
        <button type="button" className="toolbar-btn" onClick={() => handleFormat("b")} title="Bold">
          <strong>B</strong>
        </button>
        <button type="button" className="toolbar-btn" onClick={() => handleFormat("i")} title="Italic">
          <em>I</em>
        </button>
        <button type="button" className="toolbar-btn" onClick={() => handleFormat("u")} title="Underline">
          <u>U</u>
        </button>
        <button type="button" className="toolbar-btn" onClick={() => handleFormat("h3")} title="Heading">
          H3
        </button>
        <button type="button" className="toolbar-btn" onClick={() => handleFormat("p")} title="Paragraph">
          ¶
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => insertAtCursor("<div style=\"text-align: center;\">Centered Text</div>")}
          title="Center"
        >
          Center
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => insertAtCursor("<hr/>")}
          title="Horizontal Rule"
        >
          Line
        </button>
      </div>

      <textarea
        ref={textareaRef}
        className="deed-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter or paste draft deed document content here... Use the token panel on the right to insert dynamic property, seller, and purchaser fields."
        rows={18}
      />

      <div className="editor-footer">
        <span className="text-xs text-muted">
          Characters: {value.length} | Dynamic tokens syntax: <code>&#123;&#123;group.field_name&#125;&#125;</code>
        </span>
      </div>
    </div>
  );
}
