import { parseAmountToCents } from "./money";
import { CATEGORIES } from "./categories";
import { VENDOR_MAX } from "./validate-bill";

// Turns raw OCR text into the review-form fields. Pure and synchronous: no network, no storage, no
// logging. Every result is only a suggestion; the seller reviews it and the form validates it again.

export interface ParsedReceipt {
  /** Plain decimal text for the amount field ("1507.80"), or "" when nothing credible was found. */
  amount: string;
  /** The same value in cents, or null. Derived from the text, never via parseFloat. */
  amountCents: bigint | null;
  /** YYYY-MM-DD for a date input, or "" when none was found or it lies in the future. */
  date: string;
  vendor: string;
  /** A category id from CATEGORIES, or null when no keyword matched (the seller picks). */
  category: number | null;
}

// ---- amount ----

// A money token: grouped or plain digits with exactly two decimals (a bill total almost always has
// them, and it keeps dates, phone numbers, quantities and invoice numbers out), optionally after a
// currency marker. Western and Indian grouping both match; parseAmountToCents tells them apart.
// The lookbehind and the trailing "\.\d" check keep out pieces of longer numbers, such as "31.10" from
// the dotted date 31.10.2026.
const MONEY = /(?<![\d.,/-])(?:(?:rs|inr|usd)\.?|₹|\$)?\s*(\d{1,3}(?:,\d{2,3})+\.\d{2}|\d+\.\d{2})(?!\d|\.\d)/gi;
// On a total line a bare integer right after the label or a currency marker counts too ("Total 1500").
const MONEY_BARE_INT = /(?:(?:rs|inr)\.?|₹|total|due|payable|amount)\s*[:-]?\s*(\d{1,3}(?:,\d{2,3})+|\d{1,9})(?![\d.,/]\d)/gi;

const TIER1 =
  /\b(grand\s*total|total\s*amount(?:\s*due|\s*payable)?|amount\s*due|amount\s*payable|net\s*amount(?:\s*payable)?|net\s*payable|net\s*total|balance\s*due|total\s*due|total\s*payable|bill\s*amount|invoice\s*total|amt\.?\s*payable)\b/i;
const TIER2 = /\btotal\b/i;
// A line that mentions one of these is never the bill total.
const NOT_TOTAL =
  /\b(sub\s*-?\s*total|total\s*(?:items?|qty|quantity|tax|gst|discount|savings?|saved)|tendered|change|cash|paid|received|round(?:ing)?\s*off|discount|mrp|saved|tax|gst|cgst|sgst|igst|vat|cess|tip)\b/i;

// "(Incl. Tax)", "incl. GST" and "inclusive of all taxes" qualify a total, they do not make the line a tax line.
const INCL_PAREN = /\(\s*(?:incl|inclusive|including)[^)]*\)/gi;
const INCL_TAX = /\b(?:incl(?:usive|uding)?)\b\.?\s*(?:of\s+)?(?:all\s+)?(?:taxes|tax|gst|vat|cess)\b/gi;
const isNotTotal = (line: string): boolean => NOT_TOTAL.test(line.replace(INCL_PAREN, " ").replace(INCL_TAX, " "));

function lineMoney(line: string, bare: boolean): bigint[] {
  const out: bigint[] = [];
  for (const m of line.matchAll(MONEY)) {
    const cents = parseAmountToCents(m[1]);
    if (cents !== null && cents > 0n) out.push(cents);
  }
  if (bare && out.length === 0) {
    for (const m of line.matchAll(MONEY_BARE_INT)) {
      const cents = parseAmountToCents(m[1]);
      if (cents !== null && cents > 0n) out.push(cents);
    }
  }
  return out;
}

const max = (xs: bigint[]): bigint => xs.reduce((a, b) => (b > a ? b : a));

function centsToText(cents: bigint): string {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}

export function findTotalCents(text: string): bigint | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const tiers: [bigint[], bigint[]] = [[], []];
  lines.forEach((line, i) => {
    if (!line) return;
    const tier = TIER1.test(line) ? 0 : TIER2.test(line) && !isNotTotal(line) ? 1 : -1;
    if (tier === -1) return;
    if (tier === 0 && isNotTotal(line.replace(TIER1, ""))) return; // "Total tax amount" etc.
    let found = lineMoney(line, true);
    if (found.length === 0) {
      // The label and its value can land on two OCR lines.
      const next = lines.slice(i + 1).find((l) => l.length > 0);
      if (next && !TIER1.test(next) && !TIER2.test(next)) found = lineMoney(next, true);
    }
    if (found.length > 0) tiers[tier].push(max(found));
  });
  for (const t of tiers) if (t.length > 0) return max(t);

  // No label found: the largest amount on any line that is not tender, change, tax or a discount.
  const rest = lines.filter((l) => l && !isNotTotal(l)).flatMap((l) => lineMoney(l, false));
  return rest.length > 0 ? max(rest) : null;
}

// ---- date ----

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const ISO_DATE = /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g;
const DMY_DATE = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/g;
const D_MON_Y = /\b(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})\.?,?[\s-]+(\d{4}|\d{2})\b/g;
const MON_D_Y = /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/g;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function fullYear(y: string): number {
  return y.length === 2 ? 2000 + Number(y) : Number(y);
}
function monthIndex(name: string): number {
  return MONTHS.indexOf(name.slice(0, 3).toLowerCase());
}
/** YYYY-MM-DD for a real calendar date in 2000 or later, otherwise null. */
function iso(y: number, m: number, d: number): string | null {
  if (y < 2000 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

function datesOnLine(line: string): string[] {
  const out: string[] = [];
  for (const m of line.matchAll(ISO_DATE)) {
    const v = iso(Number(m[1]), Number(m[2]), Number(m[3]));
    if (v) out.push(v);
  }
  for (const m of line.matchAll(DMY_DATE)) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    // Day first (India). Month first only when the second number cannot be a month.
    const v = b > 12 && a <= 12 ? iso(fullYear(m[3]), a, b) : iso(fullYear(m[3]), b, a);
    if (v) out.push(v);
  }
  for (const m of line.matchAll(D_MON_Y)) {
    const mo = monthIndex(m[2]);
    const v = mo >= 0 ? iso(fullYear(m[3]), mo + 1, Number(m[1])) : null;
    if (v) out.push(v);
  }
  for (const m of line.matchAll(MON_D_Y)) {
    const mo = monthIndex(m[1]);
    const v = mo >= 0 ? iso(Number(m[3]), mo + 1, Number(m[2])) : null;
    if (v) out.push(v);
  }
  return out;
}

/** `today` is a YYYY-MM-DD string in the seller's local time; later dates are rejected like the form does. */
export function findDate(text: string, today: string): string {
  let best: { score: number; value: string } | null = null;
  for (const line of text.split(/\r?\n/)) {
    // A labelled bill or invoice date beats an unlabelled one; due, period and expiry dates lose.
    let score = 1;
    if (/\b(bill|invoice|inv|issue|order|txn|transaction)?\s*date(d)?\b/i.test(line)) score = 3;
    if (/\b(due|period|valid|expiry|expires|exp|from|upto|next)\b/i.test(line)) score = 0;
    for (const value of datesOnLine(line)) {
      if (value > today) continue;
      if (!best || score > best.score) best = { score, value };
    }
  }
  return best?.value ?? "";
}

// ---- vendor ----

const VENDOR_SKIP = /^(tax\s+invoice|invoice|bill|cash\s*memo|receipt|welcome|gstin|original|duplicate|customer\s+copy)\b/i;

/** The first line that reads like a name: mostly letters, at least 3 of them, not a document label. */
export function findVendor(text: string): string {
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/[^\p{L}\p{N}&.,'()\- ]/gu, " ").replace(/\s+/g, " ").trim();
    const letters = (line.match(/\p{L}/gu) ?? []).length;
    if (letters < 3 || letters < line.length * 0.5 || VENDOR_SKIP.test(line)) continue;
    return line.slice(0, VENDOR_MAX).trim();
  }
  return "";
}

// ---- category ----

const KEYWORDS: Record<number, RegExp> = {
  0: /\b(electricity|power|energy|kwh|units?\s+consumed|water\s+(?:bill|supply)|broadband|internet|postpaid|recharge|utility|municipal|discom|bsnl|jio|airtel|lpg)\b/i,
  1: /\b(super\s*mart|supermarket|mart|grocer(?:y|ies)|kirana|restaurant|cafe|caf[eé]|hotel|bakery|dairy|milk|rice|dal|atta|vegetables?|swiggy|zomato|food|kitchen|pizza|sweets?|tomato)\b/i,
  2: /\b(pharmacy|pharma|chemist|medical|medicines?|medicine|hospital|clinic|diagnostics?|pathology|laborator(?:y|ies)|doctor|dr\.|dental|patient|tablets?|insulin|rx)\b/i,
  3: /\b(petrol|diesel|fuel|petroleum|iocl?|bpcl|hpcl|uber|ola|cab|taxi|metro|irctc|railways?|flight|toll|parking|litres?|ltrs?)\b/i,
  4: /\b(apparel|fashion|clothing|garments?|footwear|shoes?|mall|electronics|retail|amazon|flipkart|myntra|lifestyle|boutique|jewell?ers?|store)\b/i,
};

/** Highest keyword score wins; hits on the vendor line count triple. Null when nothing matches. */
export function suggestCategory(text: string, vendor: string): number | null {
  let best: { id: number; score: number } | null = null;
  for (const c of CATEGORIES) {
    const re = KEYWORDS[c.id];
    if (!re) continue;
    const hits = (text.match(new RegExp(re.source, "gi")) ?? []).length;
    const vendorHits = vendor ? (vendor.match(new RegExp(re.source, "gi")) ?? []).length : 0;
    const score = hits + vendorHits * 2;
    if (score > 0 && (!best || score > best.score)) best = { id: c.id, score };
  }
  return best?.id ?? null;
}

export function parseReceiptText(text: string, today: string): ParsedReceipt {
  const cents = findTotalCents(text);
  const vendor = findVendor(text);
  return {
    amount: cents === null ? "" : centsToText(cents),
    amountCents: cents,
    date: findDate(text, today),
    vendor,
    category: suggestCategory(text, vendor),
  };
}
