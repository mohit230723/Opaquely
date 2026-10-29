// Money input to integer cents. String math and bigint only: a float round trip would drift
// (1.15 * 100 is not 115), so the text is split on the separator and each side is read as an integer.
// Shared with Phase 4, where OCR text feeds the same function.

// Digit grouping with commas: Western (1,234,567) or Indian (12,34,567). Anything else is junk.
const WESTERN_GROUPED = /^\d{1,3}(?:,\d{3})+$/;
const INDIAN_GROUPED = /^\d{1,2}(?:,\d{2})*,\d{3}$/;
// A comma used as the decimal separator: digits, one comma, one or two digits, and no dot at all.
const COMMA_DECIMAL = /^(\d+),(\d{1,2})$/;
const AMOUNT = /^(\d{1,12})(?:\.(\d{1,2}))?$/;

/**
 * "1,234.5" -> 123450n, "12,50" -> 1250n (a comma followed by one or two digits at the very end,
 * with no dot, is a decimal comma). A comma followed by three digits is grouping, Western or
 * Indian ("1,23,456.78"). Any other comma placement ("1,2,3", ",,5", "1,50.00") is rejected, never
 * guessed. Accepts at most 12 integer digits and at most 2 decimals. Returns null for anything else
 * (empty, negative, exponent, a bare dot, more than 2 decimals).
 */
export function parseAmountToCents(input: string): bigint | null {
  const text = input.trim();
  let normalized = text;
  const decimalComma = COMMA_DECIMAL.exec(text);
  if (decimalComma) {
    normalized = `${decimalComma[1]}.${decimalComma[2]}`;
  } else if (text.includes(",")) {
    const dot = text.indexOf(".");
    const intPart = dot === -1 ? text : text.slice(0, dot);
    if (!WESTERN_GROUPED.test(intPart) && !INDIAN_GROUPED.test(intPart)) return null;
    normalized = intPart.replace(/,/g, "") + (dot === -1 ? "" : text.slice(dot));
  }
  const match = AMOUNT.exec(normalized);
  if (!match) return null;
  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  return whole * 100n + fraction;
}
