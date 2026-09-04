/**
 * Party reference/master data for the Deed Party (PartyDetails) form.
 * Provides the legal "Entity Type" category, country/state/city option lists
 * (with a Maharashtra-first focus), and ID-type options. Values are the
 * bilingual labels persisted to the backend, so the grid and report stay in
 * sync with what the user selected.
 */
import { MAHARASHTRA_DISTRICTS } from "./maharashtra.js";

export const ENTITY_TYPES = [
  "Individual / व्यक्ती",
  "Hindu Undivided Family (HUF) / हिंदू अविभाजित कुटुंब",
  "Partnership Firm / भागीदारी फर्म",
  "Company / कंपनी",
  "Trust / ट्रस्ट",
  "Society / सोसायटी",
  "Co-operative Society / सहकारी संस्था",
  "Bank / Financial Institution / बँक / वित्तीय संस्था",
  "Government Body / सरकारी संस्था",
  "NGO / स्वयंसेवी संस्था",
  "Other / इतर",
];

export const COUNTRIES = [
  "India",
  "United States",
  "United Kingdom",
  "United Arab Emirates",
  "Canada",
  "Australia",
  "Singapore",
];

export const INDIAN_STATES = [
  "Maharashtra / महाराष्ट्र",
  "Delhi (NCT) / दिल्ली",
  "Karnataka / कर्नाटक",
  "Gujarat / गुजरात",
  "Madhya Pradesh / मध्य प्रदेश",
  "Rajasthan / राजस्थान",
  "Uttar Pradesh / उत्तर प्रदेश",
  "Tamil Nadu / तमिळनाडू",
  "Andhra Pradesh / आंध्र प्रदेश",
  "Telangana / तेलंगणा",
  "Kerala / केरळ",
  "Punjab / पंजाब",
  "Haryana / हरियाणा",
  "West Bengal / पश्चिम बंगाल",
  "Bihar / बिहार",
  "Goa / गोवा",
  "Chhattisgarh / छत्तीसगड",
  "Odisha / ओडिशा",
  "Assam / आसाम",
  "Jharkhand / झारखंड",
  "Others / इतर",
];

export const MAHARASHTRA_CITIES = [
  "Mumbai / मुंबई",
  "Navi Mumbai / नवी मुंबई",
  "Pimpri-Chinchwad / पिंपरी-चिंचवड",
  ...MAHARASHTRA_DISTRICTS,
];

const OTHER_STATES_CITIES = [
  "Delhi",
  "Bengaluru",
  "Hyderabad",
  "Chennai",
  "Kolkata",
  "Ahmedabad",
  "Jaipur",
  "Others / इतर",
];

/** City list is Maharashtra-first; falls back to national cities otherwise. */
export function getCitiesFor(state_en) {
  if (!state_en) return MAHARASHTRA_CITIES;
  return state_en.toLowerCase().includes("maharashtra") ? MAHARASHTRA_CITIES : OTHER_STATES_CITIES;
}

export const ID_TYPES = ["PAN", "Aadhaar", "Voter ID", "Driving Licence", "Passport"];

/** Salutation options for the Party Name (English) section. */
export const SALUTATIONS = ["Mr.", "Mrs.", "Ms.", "Dr.", "Other"];

/** Occupation options (spec §6 — should come from master data when available). */
export const OCCUPATIONS = [
  "Service",
  "Business",
  "Professional",
  "Farmer",
  "Student",
  "Retired",
  "Homemaker",
  "Other",
];

/** Gender radio options (spec §7) — bilingual labels like other master data. */
export const GENDERS = [
  "Male / पुरुष",
  "Female / स्त्री",
  "Transgender / तृतीयपंथी",
  "Other / इतर",
];

/** "Execution by" radio options (spec §18) — Self selected by default. */
export const EXECUTION_BY_OPTIONS = [
  { value: "self", label: "Self / स्वतः" },
  { value: "poa", label: "POA / मुखत्यार" },
  { value: "others", label: "Others / इतर" },
];