import "./HeaderSarita.css";
import headerImg from "../assets/header.png";
import LanguageSwitcher from "./common/LanguageSwitcher.jsx";

/** Header shown at the top of the data-entry / token-information pages.
 *  Renders the header.png image full-width. LanguageSwitcher is overlaid on
 *  top-right so the on-page UI language can be changed in the entry wizard. */
export default function HeaderSarita() {
  return (
    <header className="hs-header">
      <img src={headerImg} alt="Public Data Entry header" className="hs-header-img" />
      <div className="hs-lang-switcher">
        <LanguageSwitcher />
      </div>
    </header>
  );
}
