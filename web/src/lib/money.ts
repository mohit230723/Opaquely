// Money input to integer cents. String math and bigint only: a float round trip would drift
// (1.15 * 100 is not 115), so the text is split on the dot and each side is read as an integer.
// Shared with Phase 4, where OCR text feeds the same function.

/**
 * "1,234.5" -> 123450n. Commas are dropped first, so Western and Indian digit grouping both work.
 * Accepts at most 12 integer digits and at most 2 decimals. Returns null for anything else
 * (empty, negative, exponent, a bare dot, more than 2 decimals).
 */
export function parseAmountToCents(input: string): bigint | null {
  const match = /^\s*(\d{1,12})(?:\.(\d{1,2}))?\s*$/.exec(input.replace(/,/g, ""));
  if (!match) return null;
  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  return whole * 100n + fraction;
}
