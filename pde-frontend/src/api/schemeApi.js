import api from "./axios";

export const schemeApi = {
  // Projects
  getProjects: (search = "") => api.get(`/api/v1/projects${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  getProject: (id) => api.get(`/api/v1/projects/${id}`),
  createProject: (data) => api.post("/api/v1/projects", data),
  updateProject: (id, data) => api.put(`/api/v1/projects/${id}`, data),
  deleteProject: (id) => api.delete(`/api/v1/projects/${id}`),

  // Schemes
  getSchemes: (params = {}) => api.get("/api/v1/schemes", { params }),
  getScheme: (id) => api.get(`/api/v1/schemes/${id}`),
  createScheme: (data) => api.post("/api/v1/schemes", data),
  updateScheme: (id, data) => api.put(`/api/v1/schemes/${id}`, data),
  modifyScheme: (id) => api.post(`/api/v1/schemes/${id}/modify`),
  checkSubmissionReadiness: (id) => api.get(`/api/v1/schemes/${id}/submission-check`),
  submitScheme: (id) => api.post(`/api/v1/schemes/${id}/submit`),

  // Seller Parties
  getSellerParties: (schemeId) => api.get(`/api/v1/schemes/${schemeId}/seller-parties`),
  createSellerParty: (schemeId, data) => api.post(`/api/v1/schemes/${schemeId}/seller-parties`, data),
  getSellerParty: (partyId) => api.get(`/api/v1/seller-parties/${partyId}`),
  updateSellerParty: (partyId, data) => api.put(`/api/v1/seller-parties/${partyId}`, data),
  deleteSellerParty: (partyId) => api.delete(`/api/v1/seller-parties/${partyId}`),

  // Scheme Identifier
  getSchemeIdentifier: (schemeId) => api.get(`/api/v1/schemes/${schemeId}/identifier`),
  saveSchemeIdentifier: (schemeId, data) => api.post(`/api/v1/schemes/${schemeId}/identifier`, data),
  updateSchemeIdentifier: (schemeId, data) => api.put(`/api/v1/schemes/${schemeId}/identifier`, data),

  // Documents
  getDocuments: (schemeId) => api.get(`/api/v1/schemes/${schemeId}/documents`),
  uploadDocument: (schemeId, documentType, file) => {
    const formData = new FormData();
    formData.append("scheme_id", schemeId);
    formData.append("document_type", documentType);
    formData.append("file", file);
    return api.post(`/api/v1/schemes/${schemeId}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  downloadDocumentUrl: (schemeId, documentId) =>
    `${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}/api/v1/schemes/${schemeId}/documents/${documentId}/download`,
  deleteDocument: (schemeId, documentId) => api.delete(`/api/v1/schemes/${schemeId}/documents/${documentId}`),

  // Templates
  getTemplates: (schemeId) => api.get(`/api/v1/schemes/${schemeId}/templates`),
  getTemplate: (templateId) => api.get(`/api/v1/templates/${templateId}`),
  createTemplate: (schemeId, data) => api.post(`/api/v1/schemes/${schemeId}/templates`, data),
  updateTemplate: (templateId, data) => api.put(`/api/v1/templates/${templateId}`, data),
  deleteTemplate: (templateId) => api.delete(`/api/v1/templates/${templateId}`),
  previewTemplate: (templateId, data) => api.post(`/api/v1/templates/${templateId}/preview`, data),
  testTemplate: (templateId, data) => api.post(`/api/v1/templates/${templateId}/test`, data),
};

export default schemeApi;
