import { useEffect, useRef } from "react";
import { translateToMarathi } from "../services/translationService.js";

/**
 * Reusable English → Marathi auto-translation hook.
 *
 * Watches every paired English field in `form` and, after a debounce,
 * translates it and fills the paired Marathi field via `update`.
 *
 * Guarantees:
 *  - Marathi fields stay fully editable.
 *  - Manual Marathi text is NEVER overwritten: a Marathi field is only
 *    updated when it is empty, or still holding a value previously
 *    auto-filled by this hook.
 *  - Debounced (600ms) + cached translation service → minimal API calls.
 *  - Only explicitly configured pairs are processed (see translationPairs.js).
 *
 * @param {object} form       Current form state object.
 * @param {(field: string, value: any) => void} update  Form field setter.
 * @param {Array<{en: string, mr: string}>} pairs       Field pairs for this form.
 */
export function useEnMrAutoTranslate(form, update, pairs) {
  // Mirror of the latest form state — safe to read after `await`.
  const formRef = useRef(form);
  formRef.current = form;
  // Previous English values, to detect actual changes.
  const prevEnRef = useRef({});
  // Marathi values last written by this hook — safe to overwrite later.
  const autoFilledRef = useRef({});

  useEffect(() => {
    // Collect pairs whose English value actually changed since last pass.
    const changed = [];
    for (const { en, mr } of pairs || []) {
      const value = (form?.[en] ?? "").toString();
      if (prevEnRef.current[en] !== undefined && prevEnRef.current[en] === value) continue;
      prevEnRef.current[en] = value;
      changed.push({ en, mr, value });
    }
    if (changed.length === 0) return;

    const timer = setTimeout(async () => {
      for (const { mr, value } of changed) {
        const currentMr = (formRef.current[mr] ?? "").toString();
        const safeToFill =
          value.trim() === "" ||
          currentMr.trim() === "" ||
          currentMr === (autoFilledRef.current[mr] ?? "");

        if (!safeToFill) continue; // user typed Marathi manually — leave it alone

        if (value.trim() === "") {
          // English cleared → clear only what we auto-filled.
          if (currentMr !== "") {
            autoFilledRef.current[mr] = "";
            update(mr, "");
          }
          continue;
        }

        const translated = await translateToMarathi(value);
        if (!translated) continue;
        // Re-check against the LATEST state: user may have typed into the
        // Marathi field while the translation request was in flight.
        const latestMr = (formRef.current[mr] ?? "").toString();
        if (latestMr.trim() !== "" && latestMr !== (autoFilledRef.current[mr] ?? "")) continue;
        autoFilledRef.current[mr] = translated;
        update(mr, translated);
      }
    }, 600);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs.map((p) => form?.[p.en]).join("\u0000"), form]);
}
