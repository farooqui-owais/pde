import "./Footer.css";

/** Default copyright line shared by every page. Centralised here so that a
 *  future change to the footer is made in a single place. */
export const DEFAULT_COPYRIGHT =
  "Copyright \u00A9 (2026) iSarita, National Informatics Centre, Pune";

/**
 * Reusable page footer.
 * - Pass `office={{ dig, jdr, sro }}` to render the office strip (DIG / JDR /
 *   SRO names) shown on the data-entry steps.
 * - Pass `copyright` only when a page needs different wording; otherwise the
 *   centralised `DEFAULT_COPYRIGHT` is used.
 */
export default function Footer({ office, copyright = DEFAULT_COPYRIGHT }) {
  return (
    <footer className="app-footer">
      {office && (
        <div className="entry-footer">
          <span>DIG Name : {office.dig}</span>
          <span>JDR Name : {office.jdr}</span>
          <span>SRO Name : {office.sro}</span>
        </div>
      )}
      <div className="copyright-bar">{copyright}</div>
    </footer>
  );
}
