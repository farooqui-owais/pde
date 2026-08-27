import axios from "axios";

// Base = the API origin (dev default). Pages call paths that include the
// leading `/api` (e.g. `/api/auth/login`), so baseURL is the origin only.
const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const api = axios.create({
  baseURL,
  withCredentials: true, // send/receive cookies (needed for CSRF cookie)
});

const CSRF_HEADER = "X-CSRF-Token";

// Lazy singleton promise so ensureCsrfToken() only hits the network once.
let csrfTokenPromise = null;

/**
 * Guarantees an X-CSRF-Token is available for unsafe (mutating) requests.
 * The server returns the token in the JSON body AND sets it as a cookie;
 * we cache the body value and echo it back in the header (double-submit).
 */
export function ensureCsrfToken() {
  if (csrfTokenPromise) return csrfTokenPromise;
  csrfTokenPromise = api
    .get("/api/auth/csrf-token")
    .then((res) => res?.data?.csrf_token)
    .catch((err) => {
      // Don't cache failures — allow a retry on the next mutating request.
      csrfTokenPromise = null;
      throw err;
    });
  return csrfTokenPromise;
}

// Reset the cached promise (e.g. after a 403/CSRF failure so a fresh token is
// fetched on the next attempt).
export function resetCsrfToken() {
  csrfTokenPromise = null;
}

api.interceptors.request.use(async (config) => {
  // 1. Attach the bearer token when present.
  const token = localStorage.getItem("dn_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // 2. Don't force a JSON content-type on FormData bodies (let the browser set
  //    the multipart boundary).
  if (config.data instanceof FormData && !config.headers["Content-Type"]) {
    delete config.headers["Content-Type"];
  }

  // 3. echo X-CSRF-Token on every unsafe method (double-submit cookie pattern).
  const method = (config.method || "get").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrf = await ensureCsrfToken();
    if (csrf) config.headers[CSRF_HEADER] = csrf;
  }

  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const detail = err?.response?.data?.detail;

    // 401 -> clear session and go to /login.
    if (status === 401) {
      localStorage.removeItem("dn_token");
      localStorage.removeItem("dn_user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    // 403 especially the CSRF guard -> refreshing a stale token repairs it.
    if (status === 403 && detail === "CSRF validation failed") {
      resetCsrfToken();
      if (!err.response.data.friendly) {
        err.response.data.detail =
          "Security validation failed. Please refresh the page and try again.";
        err.response.data.friendly = true;
      }
    }

    return Promise.reject(err);
  }
);

export default api;
