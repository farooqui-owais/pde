import api from "./axios.js";

// Service module for the backend endpoints added in models_verification.py /
// routers/{execution_captures,ekyc_verifications,sign_agreements,valuation_rates}.py.
// These steps are NOT described by the iSarita manual (see GAP_ANALYSIS doc) so
// they are intentionally kept OUTSIDE the mandatory citizen stepper
// (Property -> Party -> Identification -> Report -> Confirmation) and are only
// reachable as an optional action from the Confirmation screen.

export const verificationApi = {
  // Execution captures
  listExecutionCaptures: (entryId) => api.get(`/api/v1/document-entries/${entryId}/execution-captures`),
  addExecutionCapture: (entryId, data) => api.post(`/api/v1/document-entries/${entryId}/execution-captures`, data),
  updateExecutionCapture: (captureId, data) => api.put(`/api/v1/document-entries/execution-captures/${captureId}`, data),
  deleteExecutionCapture: (captureId) => api.delete(`/api/v1/document-entries/execution-captures/${captureId}`),

  // eKYC verifications
  listEkycVerifications: (entryId) => api.get(`/api/v1/document-entries/${entryId}/ekyc-verifications`),
  startEkycVerification: (entryId, data) => api.post(`/api/v1/document-entries/${entryId}/ekyc-verifications`, data),
  updateEkycStatus: (verificationId, data) => api.put(`/api/v1/document-entries/ekyc-verifications/${verificationId}/status`, data),

  // Sign agreements
  listSignAgreements: (entryId) => api.get(`/api/v1/document-entries/${entryId}/sign-agreements`),
  createSignAgreement: (entryId, data) => api.post(`/api/v1/document-entries/${entryId}/sign-agreements`, data),
  updateSignAgreementStatus: (agreementId, data) => api.put(`/api/v1/document-entries/sign-agreements/${agreementId}/status`, data),

  // Valuation rates (reference/master data)
  listValuationRates: (params = {}) => api.get("/api/v1/valuation-rates", { params }),
  getValuationRate: (rateId) => api.get(`/api/v1/valuation-rates/${rateId}`),
  createValuationRate: (data) => api.post("/api/v1/valuation-rates", data),
  updateValuationRate: (rateId, data) => api.put(`/api/v1/valuation-rates/${rateId}`, data),
  deleteValuationRate: (rateId) => api.delete(`/api/v1/valuation-rates/${rateId}`),
};

export default verificationApi;
