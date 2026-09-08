import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api, { resetCsrfToken } from "../api/axios.js";
import "./GoogleAuthButton.css";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const GIS_SRC = "https://accounts.google.com/gsi/client";

/**
 * Google SSO button (Google Identity Services) for Login / Register.
 *
 * Renders nothing when VITE_GOOGLE_CLIENT_ID is not configured, so the
 * existing username/password flows are completely unaffected. On success it
 * stores the same JWT/session payload the classic login uses and navigates
 * to the dashboard.
 */
export default function GoogleAuthButton({ mode = "login", onError }) {
  const { t } = useTranslation(["auth"]);
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const btnRef = useRef(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (!CLIENT_ID) {
      console.warn(
        "[GoogleAuthButton] VITE_GOOGLE_CLIENT_ID is not set — Google sign-in button hidden. " +
        "Add it to pde-frontend/.env and restart the dev server."
      );
      return;
    }

    function renderButton() {
      if (initRef.current || !window.google?.accounts?.id || !btnRef.current) return;
      initRef.current = true;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredential,
        auto_select: false,
      });
      window.google.accounts.id.renderButton(btnRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        width: 320,
        text: mode === "register" ? "signup_with" : "signin_with",
        logo_alignment: "left",
      });
      setReady(true);
    }

    if (window.google?.accounts?.id) {
      renderButton();
      return;
    }
    let script = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", renderButton);
    script.addEventListener("error", () => onError?.(t("auth:googleUnavailable")));
    return () => script?.removeEventListener("load", renderButton);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function handleCredential(response) {
    const credential = response?.credential;
    if (!credential) return;
    try {
      // The axios interceptor fetches the CSRF token automatically for POSTs.
      const { data } = await api.post("/api/auth/google", { credential });
      resetCsrfToken(); // session changed — drop the cached CSRF pair
      localStorage.setItem("dn_token", data.access_token);
      localStorage.setItem("dn_user", JSON.stringify(data.user));
      navigate("/dashboard");
    } catch (err) {
      onError?.(err?.response?.data?.detail || t("auth:googleFailed"));
    }
  }

  if (!CLIENT_ID) return null;

  return (
    <div className="google-auth">
      <div className="google-auth-divider">
        <span>{t("auth:googleOr")}</span>
      </div>
      <div className="google-auth-button" ref={btnRef} style={{ visibility: ready ? "visible" : "hidden" }} />
    </div>
  );
}
