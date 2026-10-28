import { isCategoryId } from "./categories";
import { parseAmountToCents } from "./money";
import type { BillDraft } from "@/data/types";

/** The raw text and choices on the review form. */
export interface BillFormFields {
  vendor: string;
  amount: string;
  date: string;
  category: number | null;
}

export interface BillFormErrors {
  vendor?: string;
  amount?: string;
  date?: string;
  category?: string;
}

export type BillValidation = { ok: true; draft: BillDraft } | { ok: false; errors: BillFormErrors };

export const AMOUNT_ERROR = "Enter an amount greater than 0.";
export const DATE_ERROR = "Enter a valid date that is not in the future.";
export const CATEGORY_ERROR = "Choose a category.";
export const VENDOR_ERROR = "Vendor can be at most 80 characters.";
export const VENDOR_MAX = 80;

const MS_PER_DAY = 86_400_000;

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

/** The local calendar date of `now` as YYYY-MM-DD, the format a date input uses. */
export function todayInputValue(now: Date): string {
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1, 2)}-${pad(now.getDate(), 2)}`;
}

/**
 * "2026-10-01" to whole days since the Unix epoch (UTC), or null when the text is not a real
 * calendar date. A UTC round trip catches 2026-02-30 and 2026-13-01.
 */
export function dateInputToDays(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== year || back.getUTCMonth() !== month - 1 || back.getUTCDate() !== day) return null;
  return Math.round(ms / MS_PER_DAY);
}

/** Pure validation for the review form. `now` is a parameter so tests (and Phase 4) are deterministic. */
export function validateBillDraft(fields: BillFormFields, now: Date): BillValidation {
  const errors: BillFormErrors = {};

  const cents = parseAmountToCents(fields.amount);
  if (cents === null || cents <= 0n) errors.amount = AMOUNT_ERROR;

  const days = dateInputToDays(fields.date);
  // Same-length YYYY-MM-DD strings compare in calendar order, against the local date of `now`.
  if (days === null || days < 0 || fields.date > todayInputValue(now)) errors.date = DATE_ERROR;

  if (fields.category === null || !isCategoryId(fields.category)) errors.category = CATEGORY_ERROR;

  const vendor = fields.vendor.trim();
  if (vendor.length > VENDOR_MAX) errors.vendor = VENDOR_ERROR;

  if (Object.keys(errors).length > 0 || cents === null || days === null || fields.category === null) {
    return { ok: false, errors };
  }
  return { ok: true, draft: { amountCents: cents, dateDays: days, category: fields.category, vendor } };
}
