import { useTranslation } from "react-i18next";
import { LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES } from "../../i18n/index.js";

/**
 * Dropdown language switcher (§5). Persists the choice to localStorage and
 * re-inits the injected i18n instance's language; `applyHtmlLang` updates the
 * <html lang> attribute via the languageChanged event wired in i18n/index.js.
 */
export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const current = (SUPPORTED_LANGUAGES.some((l) => l.code === i18n.language)
    ? i18n.language
    : "en");

  function changeLang(code) {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
    }
    i18n.changeLanguage(code);
  }

  return (
    <select
      aria-label="language"
      className="lang-switcher"
      value={current}
      onChange={(e) => changeLang(e.target.value)}
    >
      {SUPPORTED_LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.labelLocal}
        </option>
      ))}
    </select>
  );
}