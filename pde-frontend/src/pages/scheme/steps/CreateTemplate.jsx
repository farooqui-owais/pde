import React, { useState, useEffect, useRef } from "react";
import schemeApi from "../../../api/schemeApi";
import DeedDocumentEditor from "../template/DeedDocumentEditor";
import TemplateFieldGroupsMenu from "../template/TemplateFieldGroupsMenu";
import TemplateFieldsForm from "../template/TemplateFieldsForm";
import PreviewTemplateModal from "../template/PreviewTemplateModal";
import FieldSuggestionForm from "../template/FieldSuggestionForm";

export default function CreateTemplate({ schemeId, scheme, onNext, onBack }) {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Editor State
  const [templateName, setTemplateName] = useState("");
  const [templateCode, setTemplateCode] = useState("");
  const [description, setDescription] = useState("");
  const [templateContent, setTemplateContent] = useState("");
  const [fieldGroups, setFieldGroups] = useState([]);

  // Preview Modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const insertTokenRef = useRef(null);

  const fetchTemplates = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await schemeApi.getTemplates(schemeId);
      const list = res.data || [];
      setTemplates(list);
      if (list.length > 0 && !selectedTemplateId) {
        loadTemplate(list[0]);
      } else if (list.length === 0) {
        initDefaultTemplate();
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to load templates.");
    } finally {
      setLoading(false);
    }
  };

  const initDefaultTemplate = () => {
    setSelectedTemplateId(null);
    setTemplateName("Agreement for Sale Template");
    setTemplateCode("TMPL-AGMT-01");
    setDescription("Standard deed template for flat/unit sale agreement under Maharashtra RERA.");
    setTemplateContent(
      `<div style="text-align: center;">
  <h2>AGREEMENT FOR SALE / विक्री करारनामा</h2>
</div>
<hr/>
<p>This <strong>AGREEMENT FOR SALE</strong> is entered on <strong>{{document.execution_date}}</strong> at <strong>{{project.village}}, {{project.district}}</strong>,</p>

<p><strong>BETWEEN:</strong></p>
<p><strong>{{seller.name}}</strong>, having PAN <strong>{{seller.pan}}</strong> and residing / registered at <strong>{{seller.address}}</strong>, hereinafter called the <strong>"PROMOTER / SELLER"</strong> (which expression shall include successors and assigns);</p>

<p style="text-align: center;"><strong>AND</strong></p>

<p><strong>{{party.full_name}}</strong>, having PAN <strong>{{party.pan}}</strong> and residing at <strong>{{party.address}}</strong>, hereinafter called the <strong>"PURCHASER"</strong>;</p>

<p><strong>WHEREAS:</strong></p>
<p>1. The Promoter is developing the project known as <strong>"{{project.project_name}}"</strong> under scheme <strong>"{{scheme.scheme_name}}"</strong> registered under MahaRERA No. <strong>{{scheme.maha_rera_number}}</strong>.</p>
<p>2. The Purchaser has agreed to purchase <strong>{{property.flat_number}}</strong> with Carpet Area of <strong>{{property.carpet_area}}</strong> for a total consideration of <strong>{{document.consideration_amount}}</strong>.</p>

<p><strong>NOW THIS DEED WITNESSETH:</strong></p>
<p>1. The Promoter transfers all rights, title and interest in the said property to the Purchaser.</p>
<p>2. The Stamp Duty of <strong>{{document.stamp_duty}}</strong> is duly payable as per Department of Registration and Stamps rules.</p>
<p>3. Witnessed and identified by <strong>{{identifier.name}}</strong>.</p>
`
    );
    setFieldGroups([]);
  };

  const loadTemplate = (tmpl) => {
    setSelectedTemplateId(tmpl.id);
    setTemplateName(tmpl.template_name || "");
    setTemplateCode(tmpl.template_code || "");
    setDescription(tmpl.description || "");
    setTemplateContent(tmpl.template_content || "");
    setFieldGroups(tmpl.field_groups || []);
  };

  useEffect(() => {
    if (schemeId) fetchTemplates();
  }, [schemeId]);

  const handleInsertToken = (token) => {
    if (insertTokenRef.current) {
      insertTokenRef.current(token);
    } else {
      setTemplateContent((prev) => prev + " " + token);
    }
  };

  const handleInsertClause = (clauseHtml) => {
    if (insertTokenRef.current) {
      insertTokenRef.current(`\n${clauseHtml}\n`);
    } else {
      setTemplateContent((prev) => prev + "\n" + clauseHtml);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!templateName) {
      alert("Template Name is required.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      template_name: templateName,
      template_code: templateCode,
      description,
      template_content: templateContent,
      field_groups: fieldGroups,
    };

    try {
      if (selectedTemplateId) {
        const res = await schemeApi.updateTemplate(selectedTemplateId, payload);
        setSuccess("Template updated successfully.");
        loadTemplate(res.data);
      } else {
        const res = await schemeApi.createTemplate(schemeId, payload);
        setSuccess("New template created successfully.");
        setSelectedTemplateId(res.data.id);
      }
      setTimeout(() => setSuccess(""), 3000);
      fetchTemplates();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to save template.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplateId) return;
    if (!window.confirm("Are you sure you want to delete this template?")) return;
    try {
      await schemeApi.deleteTemplate(selectedTemplateId);
      setSelectedTemplateId(null);
      fetchTemplates();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete template.");
    }
  };

  return (
    <div className="step-card">
      <div className="step-card-header">
        <div>
          <h2 className="step-title">Step 4: Create Template / डीड टेम्पलेट तयार करा</h2>
          <p className="step-desc">
            Build and customize the legal deed document template with dynamic property and party tokens.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={initDefaultTemplate}>
            + New Template
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setPreviewOpen(true)}
          >
            👁 Preview Template
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : selectedTemplateId ? "Save Template" : "Create Template"}
          </button>
        </div>
      </div>

      {error && <div className="scheme-error-box">{error}</div>}
      {success && <div className="scheme-success-box">{success}</div>}

      {/* Template Selector Tabs if multiple exist */}
      {templates.length > 0 && (
        <div className="template-tabs-bar">
          <span className="text-xs font-bold text-slate-600 mr-2">Existing Templates:</span>
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`template-tab-chip ${selectedTemplateId === t.id ? "tab-chip-active" : ""}`}
              onClick={() => loadTemplate(t)}
            >
              📄 {t.template_name}
            </button>
          ))}
        </div>
      )}

      {/* Metadata Form */}
      <div className="step-form-container mt-3">
        <div className="form-grid-3">
          <div className="form-group">
            <label>Template Name *</label>
            <input
              type="text"
              className="scheme-input"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. Agreement for Sale (Residential)"
              required
            />
          </div>

          <div className="form-group">
            <label>Template Code</label>
            <input
              type="text"
              className="scheme-input"
              value={templateCode}
              onChange={(e) => setTemplateCode(e.target.value)}
              placeholder="e.g. TMPL-SALE-01"
            />
          </div>

          <div className="form-group">
            <label>Description / Notes</label>
            <input
              type="text"
              className="scheme-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Standard 2BHK flat sale deed"
            />
          </div>
        </div>

        {/* 2-Column Workspace: Editor + Side Panel */}
        <div className="template-editor-grid mt-3">
          <div className="editor-left-column">
            <DeedDocumentEditor
              value={templateContent}
              onChange={setTemplateContent}
              onInsertTokenRef={insertTokenRef}
            />
            <TemplateFieldsForm fieldGroups={fieldGroups} onChange={setFieldGroups} />
          </div>

          <div className="editor-right-column">
            <TemplateFieldGroupsMenu onInsertToken={handleInsertToken} />
            <FieldSuggestionForm onInsertClause={handleInsertClause} />
          </div>
        </div>
      </div>

      <div className="step-footer-actions mt-4">
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back to Documents
        </button>
        <div className="flex gap-2">
          {selectedTemplateId && (
            <button
              type="button"
              className="btn btn-secondary text-red-600"
              onClick={handleDelete}
            >
              Delete Template
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={onNext}
            disabled={!templateContent || templateContent.length < 10}
          >
            Next: Submit Scheme →
          </button>
        </div>
      </div>

      {/* Preview Modal */}
      <PreviewTemplateModal
        template={{
          id: selectedTemplateId,
          template_name: templateName,
          template_content: templateContent,
        }}
        scheme={scheme}
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
