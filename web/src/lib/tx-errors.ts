import { MAX_BILLS_PER_DATASET, MIN_BILLS_TO_LIST } from "./constants";
import type { TxErrorCode } from "./tx-machine";

export const USER_REJECTED_REASON = "You rejected the request in your wallet.";
export const WRONG_NETWORK_REASON = "Switch to Hardhat (chain 31337) to continue.";
export const ENCRYPT_FAILED_REASON = "Encryption failed. Is the local node running?";
const GENERIC_REASON = "Something went wrong. Try again.";
const MAX_REASON_LENGTH = 160;

/**
 * Readable reasons keyed by the contracts' custom-error name. The Marketplace ABI also carries the
 * registry's errors, so a revert from either contract decodes here. InvalidMarketplace, NotDeployer,
 * MarketplaceAlreadySet, OnlyMarketplace and NotSealed have no entry: they are deploy-time or internal.
 */
export const REVERT_REASONS: Record<string, string> = {
  AlreadyPurchased: "You already own this dataset.",
  OwnListing: "You cannot buy your own listing.",
  PriceChanged: "The price changed. Reload the listing and try again.",
  // Seller side (Phase 4).
  TooFewBills: `Add at least ${MIN_BILLS_TO_LIST} bills before listing.`,
  TooManyBills: `A dataset can hold at most ${MAX_BILLS_PER_DATASET} bills. List this one and start a new dataset.`,
  DatasetIsSealed: "This dataset is sealed. Create a new dataset to add more bills.",
  NotDatasetOwner: "You can only change your own datasets.",
  DatasetNotFound: "Dataset not found.",
  InvalidName: "Give your dataset a name (1 to 60 characters).",
  InvalidTitle: "Give your listing a title (1 to 80 characters).",
  DescriptionTooLong: "Keep the description to 300 characters or fewer.",
  ZeroPrice: "Enter a price greater than 0 ETH.",
  InvalidCategoryMask: "Choose valid categories.",
  // FHE library errors that ride in the same ABI: a bad input proof, or a chain without the FHE contracts.
  SenderNotAllowedToUseHandle: "Encryption proof was rejected. Try adding the bill again.",
  ZamaProtocolUnsupported: "This network does not support encrypted data. Switch networks and try again.",
  // Buyer side (Phase 5 may adjust the copy).
  ListingNotFound: "Listing not found.",
  WrongPayment: "The payment must equal the listing price exactly.",
  NothingToWithdraw: "Nothing to withdraw yet.",
  TransferFailed: "The transfer failed. Try again.",
};

/** An error whose message is already fit to show the user. The stub throws these. */
export class ReadableTxError extends Error {
  readonly reason: string;
  readonly code: TxErrorCode;

  constructor(reason: string, code: TxErrorCode = "unknown") {
    super(reason);
    this.name = "ReadableTxError";
    this.reason = reason;
    this.code = code;
  }
}

interface ErrorLike {
  name?: unknown;
  code?: unknown;
  shortMessage?: unknown;
  message?: unknown;
  data?: { errorName?: unknown } | null;
  cause?: unknown;
}

/** The error and each nested cause, outermost first. Capped and cycle-safe. */
function chain(e: unknown): ErrorLike[] {
  const out: ErrorLike[] = [];
  const seen = new Set<unknown>();
  let cur: unknown = e;
  while (typeof cur === "object" && cur !== null && !seen.has(cur) && out.length < 12) {
    seen.add(cur);
    out.push(cur as ErrorLike);
    cur = (cur as ErrorLike).cause;
  }
  return out;
}

function truncate(text: string): string {
  return text.length > MAX_REASON_LENGTH ? `${text.slice(0, MAX_REASON_LENGTH - 1)}…` : text;
}

/** Turns anything a send or a receipt wait can throw into a reason and a code for TxStatus. */
export function toReadableError(e: unknown): { reason: string; code: TxErrorCode } {
  if (e instanceof ReadableTxError) return { reason: e.reason, code: e.code };

  const errors = chain(e);

  if (errors.some((x) => x.name === "UserRejectedRequestError" || x.code === 4001)) {
    return { reason: USER_REJECTED_REASON, code: "user_rejected" };
  }
  if (errors.some((x) => x.name === "ChainMismatchError")) {
    return { reason: WRONG_NETWORK_REASON, code: "wrong_network" };
  }
  for (const x of errors) {
    const name = x.data?.errorName;
    if (typeof name === "string" && Object.hasOwn(REVERT_REASONS, name)) {
      return { reason: REVERT_REASONS[name], code: "reverted" };
    }
  }

  if (e instanceof Error) {
    const e0 = e as ErrorLike;
    const text = typeof e0.shortMessage === "string" && e0.shortMessage ? e0.shortMessage : e.message;
    return { reason: truncate(text || GENERIC_REASON), code: "unknown" };
  }
  return { reason: GENERIC_REASON, code: "unknown" };
}
