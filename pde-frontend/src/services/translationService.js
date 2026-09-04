/**
 * Centralized English → Marathi translation service.
 *
 * Single source of truth for translating text to Marathi so that all forms
 * share one implementation (no duplicated logic). Uses the free Google
 * Translate (gtx) endpoint, with:
 *  - an in-memory cache (same text is never translated twice), and
 *  - in-flight request de-duplication (concurrent identical calls share one
 *    network request).
 *
 * If a dedicated backend translation endpoint is added later, only
 * `callTranslateApi` below needs to change.
 */

const MR = "mr";

const cache = new Map(); // text -> marathi text
const inFlight = new Map(); // text -> Promise<string>

/** Devanagari detection — used to skip translating text that is already Marathi. */
const DEVANAGARI_RE = /[\u0900-\u097F]/;

async function callTranslateApi(text) {
  const url =
    "https://translate.googleapis.com/translate_a/single" +
    `?client=gtx&sl=en&tl=${MR}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Translation request failed (${res.status})`);
  const data = await res.json();
  // gtx returns nested arrays of translated segments: [[["marathi","english",...],...], ...]
  const segments = Array.isArray(data?.[0]) ? data[0] : [];
  const translated = segments
    .map((seg) => (Array.isArray(seg) ? seg[0] : ""))
    .join("")
    .trim();
  if (!translated) throw new Error("Empty translation response");
  return translated;
}

/**
 * Translate English text to Marathi.
 * @param {string} text
 * @returns {Promise<string>} Marathi translation ("" for empty input)
 */
export async function translateToMarathi(text) {
  const value = (text || "").trim();
  if (!value) return "";
  // Text already containing Devanagari is assumed to be Marathi — return as-is.
  if (DEVANAGARI_RE.test(value)) return value;

  if (cache.has(value)) return cache.get(value);
  if (inFlight.has(value)) return inFlight.get(value);

  const promise = callTranslateApi(value)
    .then((translated) => {
      cache.set(value, translated);
      inFlight.delete(value);
      return translated;
    })
    .catch((err) => {
      inFlight.delete(value);
      console.warn("[translationService] translation failed:", err?.message);
      return ""; // graceful degradation — caller keeps the field unchanged
    });
  inFlight.set(value, promise);
  return promise;
}
