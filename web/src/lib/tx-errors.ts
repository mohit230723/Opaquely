import type { TxErrorCode } from "./tx-machine";

export const USER_REJECTED_REASON = "You rejected the request in your wallet.";
export const WRONG_NETWORK_REASON = "Switch to Hardhat (chain 31337) to continue.";
const GENERIC_REASON = "Something went wrong. Try again.";
const MAX_REASON_LENGTH = 160;

/**
 * Readable reasons keyed by contract custom-error name. Phase 3 should name its custom errors to
 * match (AlreadyPurchased, OwnListing, PriceChanged), or Phase 5 extends this table.
 */
export const REVERT_REASONS: Record<string, string> = {
  AlreadyPurchased: "You already own this dataset.",
  OwnListing: "You cannot buy your own listing.",
  PriceChanged: "The price changed. Reload the listing and try again.",
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
