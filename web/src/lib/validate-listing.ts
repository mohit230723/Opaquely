import { parseEther } from "viem";

export const TITLE_MAX = 80;
export const DESCRIPTION_MAX = 300;
export const TITLE_ERROR = "Add a title (1 to 80 characters).";
export const DESCRIPTION_ERROR = "Add a short description (1 to 300 characters).";
export const PRICE_ERROR = "Enter a price greater than 0 ETH.";

export interface ListingInput {
  title: string;
  description: string;
  /** Decimal ETH text exactly as typed, for example "0.05". */
  priceEth: string;
}

export interface ListingErrors {
  title?: string;
  description?: string;
  price?: string;
}

export type ListingValidation =
  | { ok: true; value: { title: string; description: string; priceWei: bigint } }
  | { ok: false; errors: ListingErrors };

/** Wei for a decimal ETH string, or null when it is not a number. No floats: viem parses the text. */
export function parsePriceWei(priceEth: string): bigint | null {
  const text = priceEth.trim();
  if (text === "") return null;
  try {
    return parseEther(text);
  } catch {
    return null;
  }
}

function lengthOk(text: string, max: number): boolean {
  return text.length >= 1 && text.length <= max;
}

/** Validates listing metadata. Title and description are trimmed; the price must be above 0 ETH. */
export function validateListingInput(input: ListingInput): ListingValidation {
  const title = input.title.trim();
  const description = input.description.trim();
  const priceWei = parsePriceWei(input.priceEth);

  const errors: ListingErrors = {};
  if (!lengthOk(title, TITLE_MAX)) errors.title = TITLE_ERROR;
  if (!lengthOk(description, DESCRIPTION_MAX)) errors.description = DESCRIPTION_ERROR;
  if (priceWei === null || priceWei <= 0n) errors.price = PRICE_ERROR;

  if (errors.title || errors.description || errors.price || priceWei === null) return { ok: false, errors };
  return { ok: true, value: { title, description, priceWei } };
}
