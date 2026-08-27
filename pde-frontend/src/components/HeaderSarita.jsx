import "./HeaderSarita.css";
import headerImg from "../assets/header.png";

/** Header shown at the top of the data-entry / token-information pages.
 *  Renders the header.png image full-width. */
export default function HeaderSarita() {
  return (
    <header className="hs-header">
      <img src={headerImg} alt="Public Data Entry header" className="hs-header-img" />
    </header>
  );
}
