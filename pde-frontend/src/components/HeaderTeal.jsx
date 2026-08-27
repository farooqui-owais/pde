import "./HeaderTeal.css";
import headerImg from "../assets/header.png";
import LanguageSwitcher from "./common/LanguageSwitcher.jsx";

/** Header shown on Dashboard, Login, Register.
 *  Renders the exact header.png banner (matches the "Public Data Entry"
 *  reference screens) instead of recreating the gradient/emblems in CSS —
 *  the source image already has the correct fonts, emblem artwork and
 *  gradient stops, so recreating it in markup will always drift from the
 *  reference. LanguageSwitcher is overlaid on top-right of the image. */
export default function HeaderTeal() {
  return (
    <header className="ht-header">
      <img src={headerImg} alt="Public Data Entry header" className="ht-header-img" />
      <div className="ht-lang-switcher">
        <LanguageSwitcher />
      </div>
    </header>
  );
}
