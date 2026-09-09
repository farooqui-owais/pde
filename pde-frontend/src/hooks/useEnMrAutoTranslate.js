import { useEffect, useRef } from "react";
import { translateToMarathi } from "../services/translationService.js";

const DEBOUNCE_MS = 600;

/**
 * Reusable English → Marathi auto-convert hook ("Type in English, get in Marathi").
 *
 * Watches every paired English field in `form` and, after a debounce,
 * transliterates it and fills the paired Marathi field via `update`.
 *
 * Guarantees:
 *  - Marathi fields stay fully editable.
 *  - Manual Marathi text is NEVER overwritten: a Marathi field is only
 *    updated when it is empty, or still holding a value previously
 *    auto-filled by this hook.
 *  - Clearing an English field only clears Marathi text that this hook
 *    itself auto-filled (never user-typed Marathi).
 *  - Debounced (600ms), cached conversion service, in-flight dedup.
 *  - Pending conversions SURVIVE re-renders caused by typing in other
 *    fields (queued in a ref, not tied to a single effect run).
 *  - Stale results are dropped: if the English value changed (or the user
 *    typed into the Marathi field) while a request was in flight, the
 *    result is discarded.
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
  const updateRef = useRef(update);
  updateRef.current = update;
  // Previous English values, to detect actual changes.
  const prevEnRef = useRef({});
  // Marathi values last written by this hook — safe to overwrite later.
  const autoFilledRef = useRef({});
  // Queue of {en, mr, value} awaiting conversion — survives effect re-runs.
  const pendingRef = useRef([]);
  const timerRef = useRef(null);

  function runPending() {
    const batch = pendingRef.current;
    pendingRef.current = [];
    (async () => {
      for (const { en, mr, value } of batch) {
        // Skip if the English value changed again since this was queued —
        // a newer entry (if any) is already in a later batch.
        if ((formRef.current[en] ?? "").toString() !== value) continue;

        const latestMr = (formRef.current[mr] ?? "").toString();
        if (latestMr.trim() !== "" && latestMr !== (autoFilledRef.current[mr] ?? "")) {
          continue; // user typed Marathi manually — leave it alone
        }

        const converted = await translateToMarathi(value);
        if (!converted) continue;
        // Re-check BOTH sides against the LATEST state: the user may have
        // typed into either field while the request was in flight.
        if ((formRef.current[en] ?? "").toString() !== value) continue;
        const finalMr = (formRef.current[mr] ?? "").toString();
        if (finalMr.trim() !== "" && finalMr !== (autoFilledRef.current[mr] ?? "")) continue;

        autoFilledRef.current[mr] = converted;
        updateRef.current(mr, converted);
      }
    })();
  }

  useEffect(() => {
    // 1) Clear auto-filled Marathi for English fields that were emptied.
    //    Only OUR auto-filled values are cleared — manual Marathi survives.
    for (const { en, mr } of pairs || []) {
      const value = (form?.[en] ?? "").toString();
      if (value.trim() !== "") continue;
      const currentMr = (formRef.current[mr] ?? "").toString();
      if (currentMr !== "" && currentMr === (autoFilledRef.current[mr] ?? "")) {
        autoFilledRef.current[mr] = "";
        updateRef.current(mr, "");
      }
    }

    // 2) Queue pairs whose English value actually changed since last pass.
    let queued = false;
    for (const { en, mr } of pairs || []) {
      const value = (form?.[en] ?? "").toString();
      if (prevEnRef.current[en] !== undefined && prevEnRef.current[en] === value) continue;
      prevEnRef.current[en] = value;
      if (value.trim() === "") continue; // nothing to convert
      // One pending entry per field: a newer edit replaces the older one.
      pendingRef.current = pendingRef.current.filter((p) => p.en !== en);
      pendingRef.current.push({ en, mr, value });
      queued = true;
    }

    // 3) (Re)arm the debounce timer whenever there is pending work —
    //    including across re-renders triggered by typing in OTHER fields.
    if (!queued && pendingRef.current.length === 0) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(runPending, DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs.map((p) => form?.[p.en]).join("\u0000"), form]);
}
