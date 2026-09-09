/**
 * Centralized English → Marathi conversion service.
 *
 * Single source of truth for converting English text to Marathi so that all
 * forms share one implementation (no duplicated logic).
 *
 * Strategy ("Type in English, get in Marathi"):
 *  1. TRANSLITERATION (primary) — Google Input Tools phonetic converter.
 *     "Shinde" → "शिंदे", "Tukaram" → "तुकाराम". This is what the iSarita
 *     manual describes and what users expect for names/addresses.
 *  2. MACHINE TRANSLATION (fallback) — free Google Translate (gtx) endpoint,
 *     used only when transliteration is unavailable/fails.
 *
 * Both paths are wrapped with:
 *  - an in-memory cache (same text is never converted twice), and
 *  - in-flight request de-duplication (concurrent identical calls share one
 *    network request).
 */

const MR = "mr";

const cache = new Map(); // text -> marathi text
const inFlight = new Map(); // text -> Promise<string>

/** Devanagari detection — used to skip converting text that is already Marathi. */
const DEVANAGARI_RE = /[\u0900-\u097F]/;
/** Only values containing at least one Latin letter or digit are convertible. */
const HAS_LETTERS_OR_DIGITS_RE = /[A-Za-z0-9]/;

/**
 * ASCII digits → Devanagari numerals ("101" → "१०१").
 * The Google Input Tools transliteration API echoes digits unchanged, so
 * numeric conversion is done locally (instant, no network round-trip).
 */
const DIGIT_MAP = { "0": "०", "1": "१", "2": "२", "3": "३", "4": "४", "5": "५", "6": "६", "7": "७", "8": "८", "9": "९" };

function toDevanagariDigits(text) {
  return text.replace(/[0-9]/g, (d) => DIGIT_MAP[d]);
}

/** Phonetic transliteration via Google Input Tools. */
async function callTransliterateApi(text) {
  const url =
    "https://inputtools.google.com/request" +
    `?text=${encodeURIComponent(text)}&itc=mr-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Transliteration request failed (${res.status})`);
  const data = await res.json();
  // Success shape: ["SUCCESS", [["<raw input>", ["<candidate1>", "<candidate2>", ...], [], {...}]]]
  // The transliterated text is the FIRST CANDIDATE (index [1][0][1][0]),
  // NOT [1][0][0] — that element echoes the original Latin input.
  if (data?.[0] !== "SUCCESS") throw new Error("Transliteration unsuccessful");
  const candidates = Array.isArray(data?.[1]?.[0]) ? data[1][0][1] : [];
  const result = (Array.isArray(candidates) ? candidates[0] : "") || "";
  const cleaned = result.trim();
  if (!cleaned) throw new Error("Empty transliteration response");
  return cleaned;
}

/** Machine translation via the free gtx endpoint (fallback). */
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

async function convertRaw(value) {
  try {
    return await callTransliterateApi(value);
  } catch (err) {
    console.warn("[translationService] transliteration failed, falling back to translation:", err?.message);
    return callTranslateApi(value);
  }
}

/**
 * Convert English text to Marathi (transliteration-first).
 * @param {string} text
 * @returns {Promise<string>} Marathi text ("" for empty/unsuitable input or on failure)
 */
export async function translateToMarathi(text) {
  const value = (text || "").trim();
  if (!value) return "";
  // Text already containing Devanagari is assumed to be Marathi — return as-is.
  if (DEVANAGARI_RE.test(value)) return value;
  // Nothing convertible (pure symbols/punctuation) — leave untouched.
  if (!HAS_LETTERS_OR_DIGITS_RE.test(value)) return "";

  // Numbers-only input (e.g. Flat No. "101", Floor No. "3") needs no API:
  // convert ASCII digits to Devanagari numerals locally, instantly.
  if (!/[A-Za-z]/.test(value)) {
    const digitsOnly = toDevanagariDigits(value);
    cache.set(value, digitsOnly);
    return digitsOnly;
  }

  if (cache.has(value)) return cache.get(value);
  if (inFlight.has(value)) return inFlight.get(value);

  const promise = convertRaw(value)
    .then((converted) => {
      // Mixed text (e.g. "Flat 101") — the API transliterates the letters
      // but echoes digits unchanged, so convert digits here as well.
      converted = toDevanagariDigits(converted);
      cache.set(value, converted);
      inFlight.delete(value);
      return converted;
    })
    .catch((err) => {
      inFlight.delete(value);
      console.warn("[translationService] conversion failed:", err?.message);
      return ""; // graceful degradation — caller keeps the field unchanged
    });
  inFlight.set(value, promise);
  return promise;
}
