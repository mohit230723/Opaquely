import type { BillFormFields } from "./validate-bill";

// Merges an OCR suggestion into the review form without throwing away what the seller typed.
// A field takes the suggestion only when it is empty or still holds the value the last suggestion
// put there (the seller has not touched it). Pure: no storage, no logging.

const FIELDS = ["vendor", "amount", "date", "category"] as const;

const isEmpty = (v: string | number | null): boolean => v === null || (typeof v === "string" && v.trim() === "");

export interface MergedPrefill {
  fields: BillFormFields;
  /** What the suggestions put in the form so far, per field. Pass it back into the next merge. */
  applied: BillFormFields;
}

export function mergePrefill(current: BillFormFields, suggestion: BillFormFields, applied: BillFormFields): MergedPrefill {
  const fields = { ...current };
  const nextApplied = { ...applied };
  for (const key of FIELDS) {
    // Typed by the seller: not empty and not what the last suggestion wrote. Leave it alone.
    if (!isEmpty(current[key]) && current[key] !== applied[key]) continue;
    (fields as Record<string, string | number | null>)[key] = suggestion[key];
    (nextApplied as Record<string, string | number | null>)[key] = suggestion[key];
  }
  return { fields, applied: nextApplied };
}

/** True when a parse produced nothing the seller could use: no amount, no date and no category. */
export function isEmptyParse(p: { amount: string; date: string; category: number | null }): boolean {
  return p.amount === "" && p.date === "" && p.category === null;
}
