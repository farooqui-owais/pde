// src/i18n/index.js — initialize i18next (react-i18next) for the frontend.
// Follows REUSABLE_PROJECT_PROMPT.md §5: namespace-split locales, a shared
// default namespace, browser-language detection behind localStorage, and
// keeping `<html lang>` in sync on init and on every language change.

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import commonEN from "./locales/en/common.json";
import authEN from "./locales/en/auth.json";
import pagesEN from "./locales/en/pages.json";
import commonMR from "./locales/mr/common.json";
import authMR from "./locales/mr/auth.json";
import pagesMR from "./locales/mr/pages.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", labelLocal: "English" },
  { code: "mr", label: "Marathi", labelLocal: "मराठी" },
];

export const DEFAULT_LANGUAGE = "en";

export const LANGUAGE_STORAGE_KEY = "pde_lang";

const ns = ["common", "auth", "pages"];

i18n
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    resources: {
      en: { common: commonEN, auth: authEN, pages: pagesEN },
      mr: { common: commonMR, auth: authMR, pages: pagesMR },
    },
    fallbackLng: DEFAULT_LANGUAGE,
    defaultNS: "common",
    ns,
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    interpolation: { escapeValue: false }, // react already escapes
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ["localStorage"],
    },
  });

// Keep <html lang> in sync with the active language.
export function applyHtmlLang(lng = i18n.language) {
  document.documentElement.lang = lng || DEFAULT_LANGUAGE;
}
applyHtmlLang();
i18n.on("languageChanged", applyHtmlLang);

export default i18n;