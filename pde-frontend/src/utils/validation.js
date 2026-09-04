/**
 * Shared client-side validators mirroring pde-backend/app/validators.py and schemas.
 * Functions return an i18n key (validation:* namespace) or null when valid.
 */

export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const MOBILE_RE = /^[6-9]\d{9}$/;
export const PIN_CODE_RE = /^\d{6}$/;
export const USERNAME_RE = /^[a-zA-Z0-9_]{3,50}$/;
export const TOKEN_NUMBER_RE = /^\d{11}$/;

export const AADHAAR_RE = /^\d{12}$/;
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

export const MANDATORY_SCHEME_DOCUMENT_TYPES = [
  "7/12 Extract / Index II",
  "MahaRERA Certificate",
  "Approved Layout / Sanction Plan",
  "Title & Search Certificate",
];

export const DRAFT_CATEGORIES_REQUIRED = [
  "Digital Document (without Execution Page)",
  "Digital Execution Page (without sign)",
];
export const MIN_AGE = 1;
export const MAX_AGE = 120;

export function firstError(...checks) {
  return checks.find(Boolean) ?? null;
}

export function validateRequired(value, key = "validation.required") {
  if (value === null || value === undefined || String(value).trim() === "") return key;
  return null;
}

export function validatePan(value, { required = false } = {}) {
  if (!value || !String(value).trim()) {
    return required ? "validation.panRequired" : null;
  }
  if (!PAN_RE.test(String(value).trim().toUpperCase())) return "validation.panInvalid";
  return null;
}

export function validateMobile(value, { required = false } = {}) {
  if (!value || !String(value).trim()) {
    return required ? "validation.mobileRequired" : null;
  }
  if (!MOBILE_RE.test(String(value).trim())) return "validation.mobileInvalid";
  return null;
}

export function validatePinCode(value, { required = false } = {}) {
  if (!value || !String(value).trim()) {
    return required ? "validation.pinRequired" : null;
  }
  if (!PIN_CODE_RE.test(String(value).trim())) return "validation.pinInvalid";
  return null;
}

export function validatePassword(value) {
  if (!value || String(value).length < MIN_PASSWORD_LENGTH) return "validation.passwordTooShort";
  return null;
}

export function validatePasswordMatch(password, confirm) {
  if (password !== confirm) return "validation.passwordMismatch";
  return null;
}

export function validateUsername(value) {
  const err = validateRequired(value);
  if (err) return err;
  if (!USERNAME_RE.test(String(value).trim())) return "validation.usernameInvalid";
  return null;
}

export function validateAge(value, { required = false } = {}) {
  if (value === "" || value === null || value === undefined) {
    return required ? "validation.ageRequired" : null;
  }
  const n = Number(value);
  if (Number.isNaN(n) || n < MIN_AGE || n > MAX_AGE) return "validation.ageInvalid";
  return null;
}

export function validatePositiveNumber(value, { required = false, fieldKey = "validation.amountInvalid" } = {}) {
  if (value === "" || value === null || value === undefined) {
    return required ? "validation.required" : null;
  }
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) return fieldKey;
  return null;
}

export function validatePositiveAmount(value, { required = false } = {}) {
  if (value === "" || value === null || value === undefined) {
    return required ? "validation.required" : null;
  }
  const n = Number(value);
  if (Number.isNaN(n) || n <= 0) return "validation.amountMustBePositive";
  return null;
}

export function hasBilingualName(firstEn, firstMr, surnameEn = "", surnameMr = "") {
  return [firstEn, firstMr, surnameEn, surnameMr].some((v) => v && String(v).trim());
}

export function validateRegistrationForm(form) {
  return firstError(
    validateRequired(form.first_name),
    validateRequired(form.username),
    validateUsername(form.username),
    validatePassword(form.password),
    validatePasswordMatch(form.password, form.confirm_password),
    validateMobile(form.mobile_number, { required: true }),
    validatePinCode(form.pin_code, { required: true }),
    validatePan(form.pan_number),
  );
}

export function validateProfileForm(form) {
  return firstError(
    validateRequired(form.first_name),
    validateMobile(form.mobile_number, { required: true }),
    validatePinCode(form.pin_code, { required: true }),
    validatePan(form.pan_number),
  );
}

export function validateDocumentEntryForm(form) {
  return firstError(
    validateRequired(form.article_type_id, "validation.articleRequired"),
    validatePositiveNumber(form.market_value, { required: true, fieldKey: "validation.marketValueRequired" }),
    validatePositiveNumber(form.consideration_amount, {
      required: true,
      fieldKey: "validation.considerationRequired",
    }),
    form.number_of_pages !== "" && form.number_of_pages != null
      ? validatePositiveNumber(form.number_of_pages, { fieldKey: "validation.pagesInvalid" })
      : null,
    form.date_of_execution &&
      form.date_of_presentation &&
      form.date_of_presentation < form.date_of_execution
      ? "validation.presentationBeforeExecution"
      : null,
  );
}

export function validatePropertyForm(form) {
  return firstError(
    validateRequired(form.district, "validation.districtRequired"),
    validateRequired(form.village_name, "validation.villageRequired"),
    form.area !== "" && form.area != null && Number(form.area) <= 0 ? "validation.areaInvalid" : null,
  );
}

export function validatePartyForm(form) {
  return firstError(
    validateRequired(form.party_type, "validation.partyTypeRequired"),
    validateRequired(form.entity_type, "validation.entityTypeRequired"),
    hasBilingualName(form.first_name_en, form.first_name_mr, form.surname_en, form.surname_mr)
      ? null
      : "validation.partyNameRequired",
    !form.pan_number && !form.declaration_form_60_61 ? "validation.panOrDeclaration" : null,
    validatePan(form.pan_number),
    validateMobile(form.mobile_number),
    validatePinCode(form.pin_code),
    validateAge(form.age),
    validateRequired(form.country, "validation.countryRequired"),
    validateRequired(form.state_en, "validation.stateRequired"),
    validateRequired(form.city_en, "validation.cityRequired"),
  );
}

export function validateWitnessForm(form) {
  return firstError(
    hasBilingualName(form.first_name_en, form.first_name_mr, form.surname_en, form.surname_mr)
      ? null
      : "validation.witnessNameRequired",
    validateAge(form.age, { required: true }),
    validateRequired(form.identification_proof, "validation.proofTypeRequired"),
    validateRequired(form.proof_number, "validation.proofNumberRequired"),
    !form.address_en?.trim() && !form.address_mr?.trim() ? "validation.witnessAddressRequired" : null,
    validatePinCode(form.pin_code),
  );
}

export function validateRentTermsForm({ licensePeriod, fromDate, toDate, slabs }) {
  const filledSlabs = (slabs || []).filter((s) => s.to_month || s.rent);
  if (filledSlabs.length === 0 && !licensePeriod && !fromDate) {
    return "validation.rentTermsRequired";
  }
  if (fromDate && toDate && toDate < fromDate) return "validation.rentDateOrder";
  for (const slab of filledSlabs) {
    if (!slab.to_month || !slab.rent) return "validation.rentSlabIncomplete";
    if (Number(slab.rent) < 0) return "validation.amountInvalid";
  }
  return null;
}

export function validateStampPaymentForm(form) {
  return validatePositiveAmount(form.amount, { required: true });
}

export function validateSlotBookingForm({ officeId, bookingDate }) {
  return firstError(
    validateRequired(officeId, "validation.officeRequired"),
    validateRequired(bookingDate, "validation.dateRequired"),
  );
}

export function validateAadhaar(value, { required = false } = {}) {
  if (!value || !String(value).trim()) {
    return required ? "validation.aadhaarRequired" : null;
  }
  if (!AADHAAR_RE.test(String(value).trim())) return "validation.aadhaarInvalid";
  return null;
}

export function validatePdfFile(file, { maxBytes = MAX_PDF_BYTES } = {}) {
  if (!file) return "validation.fileRequired";
  if (!file.name?.toLowerCase().endsWith(".pdf")) return "validation.pdfOnly";
  if (file.size > maxBytes) return "validation.fileTooLarge";
  return null;
}

export function validateForgotPasswordVerifyForm(form) {
  return firstError(
    validateRequired(form.username, "validation.usernameRequired"),
    validateRequired(form.security_question, "validation.securityQuestionRequired"),
    validateRequired(form.security_answer, "validation.securityAnswerRequired"),
  );
}

export function validateForgotPasswordResetForm(form) {
  return firstError(
    validatePassword(form.new_password),
    validatePasswordMatch(form.new_password, form.confirm_password),
  );
}

export function validateForgotUsernameForm(form) {
  return firstError(
    validateMobile(form.mobile_number, { required: true }),
    validateRequired(form.security_question, "validation.securityQuestionRequired"),
    validateRequired(form.security_answer, "validation.securityAnswerRequired"),
  );
}

export function validateOtp(value) {
  if (!value || !String(value).trim()) return "validation.otpRequired";
  if (!/^\d{4,8}$/.test(String(value).trim())) return "validation.otpInvalid";
  return null;
}

export function validateSchemeSellerForm(form) {
  return firstError(
    validateRequired(form.party_name, "validation.partyNameRequired"),
    validateRequired(form.party_category, "validation.partyTypeRequired"),
    validatePan(form.pan_number),
    validateAadhaar(form.aadhaar_number),
    validateMobile(form.mobile_number),
    validatePinCode(form.pincode),
    form.party_category === "Company" && !form.company_name?.trim()
      ? "validation.companyNameRequired"
      : null,
    form.party_category === "Power of Attorney" && !form.poa_holder_name?.trim()
      ? "validation.poaHolderRequired"
      : null,
    form.party_category === "Power of Attorney" && !form.poa_document_number?.trim()
      ? "validation.poaDocumentRequired"
      : null,
  );
}

export function validateSchemeIdentifierForm(form) {
  return firstError(
    validateRequired(form.name, "validation.identifierNameRequired"),
    validateRequired(form.address, "validation.addressRequired"),
    validatePan(form.pan_number),
    validateAadhaar(form.aadhaar_number),
    validateMobile(form.mobile_number),
    validatePinCode(form.pincode),
    validateAge(form.age),
  );
}

export function validateSchemeCreateForm(form) {
  return firstError(
    form.newProjectMode
      ? validateRequired(form.project_name, "validation.projectNameRequired")
      : validateRequired(form.selectedProjectId, "validation.projectRequired"),
    validateRequired(form.scheme_name, "validation.schemeNameRequired"),
  );
}

export function validateDigitalDraftUpload({ file, category }) {
  return firstError(
    validatePdfFile(file),
    validateRequired(category, "validation.draftCategoryRequired"),
  );
}

export function validateDigitalSubmissionNext({ wantsDigital, draftList, submitted }) {
  if (!wantsDigital) return null;
  if (submitted) return null;
  const categories = new Set((draftList || []).map((d) => d.category));
  const missing = DRAFT_CATEGORIES_REQUIRED.filter((c) => !categories.has(c));
  if (missing.length) return "validation.digitalDraftsRequired";
  return null;
}

/** Turn FastAPI 422 / 400 detail into a display string. */
export function formatApiValidationError(detail, t) {
  if (!detail) return t("validation.genericError");
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((e) => e.msg || e.message || JSON.stringify(e)).join("; ");
  }
  if (detail.errors && Array.isArray(detail.errors)) {
    return detail.errors.join("; ");
  }
  if (detail.message) return detail.message;
  return JSON.stringify(detail);
}
