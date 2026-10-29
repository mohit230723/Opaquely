import { parseEther } from "viem";
import type { Listing, ListingFilter } from "@/data/types";

export const ETH_INPUT_ERROR = "Enter a valid ETH amount.";

export type EthInput = { value?: bigint; error?: string };

// Digits with an optional single decimal point. No sign, no exponent, no spaces inside.
const DECIMAL = /^(\d+\.?\d*|\.\d+)$/;

/**
 * Wei for the text of a price box. Empty means "no bound" ({}), a valid decimal gives { value },
 * anything else gives { error }. viem parses the text, so there is no float math.
 */
export function parseEthInput(text: string): EthInput {
  const trimmed = text.trim();
  if (trimmed === "") return {};
  if (!DECIMAL.test(trimmed)) return { error: ETH_INPUT_ERROR };
  try {
    return { value: parseEther(trimmed) };
  } catch {
    return { error: ETH_INPUT_ERROR };
  }
}

/** Pure listing filter, shared with the Phase 5 live listings. An unparsable price bound is ignored. */
export function applyListingFilter(listings: Listing[], filter: ListingFilter): Listing[] {
  const min = parseEthInput(filter.minEth ?? "").value;
  const max = parseEthInput(filter.maxEth ?? "").value;
  const q = (filter.query ?? "").trim().toLowerCase();
  return listings.filter(
    (l) =>
      (filter.categories.length === 0 || filter.categories.some((c) => l.categories.includes(c))) &&
      (min === undefined || l.priceWei >= min) &&
      (max === undefined || l.priceWei <= max) &&
      (q === "" || l.title.toLowerCase().includes(q) || l.seller.toLowerCase().includes(q)),
  );
}

/** True when any filter field holds something (so the Clear filters action should show). */
export function isFilterActive(filter: ListingFilter): boolean {
  return (
    filter.categories.length > 0 ||
    (filter.minEth ?? "").trim() !== "" ||
    (filter.maxEth ?? "").trim() !== "" ||
    (filter.query ?? "").trim() !== ""
  );
}
