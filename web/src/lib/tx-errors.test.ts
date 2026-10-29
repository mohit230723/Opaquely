import { describe, expect, it } from "vitest";
import {
  ENCRYPT_FAILED_REASON,
  REVERT_REASONS,
  ReadableTxError,
  USER_REJECTED_REASON,
  WRONG_NETWORK_REASON,
  toReadableError,
} from "./tx-errors";
import { getDeployment } from "@/contracts";

/** An error shaped like a viem error: a name, an optional code and a cause chain. */
function named(name: string, extra: Record<string, unknown> = {}, cause?: unknown): Error {
  const e = new Error(name) as Error & Record<string, unknown>;
  e.name = name;
  Object.assign(e, extra);
  if (cause !== undefined) e.cause = cause;
  return e;
}

describe("toReadableError", () => {
  it("passes a ReadableTxError through with its reason and code", () => {
    const e = new ReadableTxError("Simulated failure: execution reverted.", "reverted");
    expect(toReadableError(e)).toEqual({ reason: "Simulated failure: execution reverted.", code: "reverted" });
  });

  it("defaults a ReadableTxError code to unknown", () => {
    expect(toReadableError(new ReadableTxError("Custom."))).toEqual({ reason: "Custom.", code: "unknown" });
  });

  it("maps UserRejectedRequestError by name", () => {
    expect(toReadableError(named("UserRejectedRequestError"))).toEqual({
      reason: USER_REJECTED_REASON,
      code: "user_rejected",
    });
  });

  it("maps a 4001 code", () => {
    expect(toReadableError(named("Error", { code: 4001 }))).toEqual({
      reason: USER_REJECTED_REASON,
      code: "user_rejected",
    });
  });

  it("maps a 4001 code on a nested cause", () => {
    const e = named("TransactionExecutionError", {}, named("Error", { code: 4001 }));
    expect(toReadableError(e).code).toBe("user_rejected");
  });

  it("maps a nested UserRejectedRequestError", () => {
    const e = named("TransactionExecutionError", {}, named("UserRejectedRequestError"));
    expect(toReadableError(e)).toEqual({ reason: USER_REJECTED_REASON, code: "user_rejected" });
  });

  it("maps ChainMismatchError to the wrong-network reason", () => {
    expect(toReadableError(named("ChainMismatchError"))).toEqual({
      reason: WRONG_NETWORK_REASON,
      code: "wrong_network",
    });
  });

  it("maps a nested ChainMismatchError", () => {
    const e = named("TransactionExecutionError", {}, named("ChainMismatchError"));
    expect(toReadableError(e)).toEqual({ reason: WRONG_NETWORK_REASON, code: "wrong_network" });
  });

  it("maps contract revert names from the reason table", () => {
    for (const [errorName, reason] of [
      ["AlreadyPurchased", "You already own this dataset."],
      ["OwnListing", "You cannot buy your own listing."],
      ["PriceChanged", "The price changed. Reload the listing and try again."],
    ] as const) {
      const e = named("ContractFunctionExecutionError", {}, named("ContractFunctionRevertedError", { data: { errorName } }));
      expect(toReadableError(e)).toEqual({ reason, code: "reverted" });
      expect(REVERT_REASONS[errorName]).toBe(reason);
    }
  });

  it("maps a top-level ContractFunctionRevertedError-shaped error", () => {
    const e = named("ContractFunctionRevertedError", { data: { errorName: "PriceChanged" } });
    expect(toReadableError(e).code).toBe("reverted");
  });

  it("falls back to shortMessage, then message, for an unknown error name", () => {
    const withShort = named("Error", { shortMessage: "Short text." });
    expect(toReadableError(withShort)).toEqual({ reason: "Short text.", code: "unknown" });
    expect(toReadableError(new Error("Plain message"))).toEqual({ reason: "Plain message", code: "unknown" });
  });

  it("truncates long messages to 160 characters", () => {
    const r = toReadableError(new Error("x".repeat(500)));
    expect(r.reason.length).toBeLessThanOrEqual(160);
    expect(r.code).toBe("unknown");
  });

  it("returns a generic reason for a non-Error value", () => {
    expect(toReadableError("boom")).toEqual({ reason: "Something went wrong. Try again.", code: "unknown" });
    expect(toReadableError(undefined)).toEqual({ reason: "Something went wrong. Try again.", code: "unknown" });
  });

  it("survives a circular cause chain", () => {
    const a = named("Error") as Error & { cause?: unknown };
    a.cause = a;
    expect(toReadableError(a).code).toBe("unknown");
  });
});

describe("Phase 4 revert reasons", () => {
  const NEW_KEYS = [
    "TooFewBills", "TooManyBills", "DatasetIsSealed", "NotDatasetOwner", "DatasetNotFound", "InvalidName", "InvalidTitle",
    "DescriptionTooLong", "ZeroPrice", "InvalidCategoryMask", "ListingNotFound", "WrongPayment", "NothingToWithdraw", "TransferFailed",
  ];

  it.each(NEW_KEYS)("decodes %s from a nested revert", (errorName) => {
    const e = named("ContractFunctionExecutionError", {}, named("ContractFunctionRevertedError", { data: { errorName } }));
    expect(toReadableError(e)).toEqual({ reason: REVERT_REASONS[errorName], code: "reverted" });
  });

  it("reads the fixed copy the screens rely on", () => {
    expect(REVERT_REASONS.TooFewBills).toBe("Add at least 3 bills before listing.");
    expect(REVERT_REASONS.TooManyBills).toContain("at most 50 bills");
    expect(ENCRYPT_FAILED_REASON).toBe("Encryption failed. Is the local node running?");
  });
});

describe("REVERT_REASONS covers the Marketplace ABI", () => {
  // Errors a user can never trigger from the UI (setup, access to internals, library guards).
  const INTERNAL = [
    "InvalidMarketplace",
    "MarketplaceAlreadySet",
    "NotDeployer",
    "NotSealed",
    "OnlyMarketplace",
    "ReentrancyGuardReentrantCall",
  ];
  const abi = getDeployment(31337)!.market.abi as readonly { type: string; name?: string }[];
  const errorNames = abi.filter((x) => x.type === "error").map((x) => x.name as string);

  it("gives every user-reachable error fixed copy", () => {
    const missing = errorNames.filter((n) => !INTERNAL.includes(n) && !(n in REVERT_REASONS));
    expect(missing, `Marketplace errors without a REVERT_REASONS entry: ${missing.join(", ")}`).toEqual([]);
  });

  it("words the two FHE library errors (IN-02)", () => {
    expect(REVERT_REASONS.SenderNotAllowedToUseHandle).toBe("Encryption proof was rejected. Try adding the bill again.");
    expect(REVERT_REASONS.ZamaProtocolUnsupported).toContain("does not support encrypted data");
    const e = named("ContractFunctionExecutionError", {}, named("ContractFunctionRevertedError", { data: { errorName: "SenderNotAllowedToUseHandle" } }));
    expect(toReadableError(e)).toEqual({ reason: REVERT_REASONS.SenderNotAllowedToUseHandle, code: "reverted" });
  });

  it("lists internal errors that really exist in the ABI", () => {
    for (const name of INTERNAL) expect(errorNames, name).toContain(name);
  });

  it("words the seven buyer reasons exactly", () => {
    expect(REVERT_REASONS.AlreadyPurchased).toBe("You already own this dataset.");
    expect(REVERT_REASONS.OwnListing).toBe("You cannot buy your own listing.");
    expect(REVERT_REASONS.PriceChanged).toBe("The price changed. Reload the listing and try again.");
    expect(REVERT_REASONS.ListingNotFound).toBe("Listing not found.");
    expect(REVERT_REASONS.WrongPayment).toBe("The payment must equal the listing price exactly.");
    expect(REVERT_REASONS.NothingToWithdraw).toBe("Nothing to withdraw yet.");
    expect(REVERT_REASONS.TransferFailed).toBe("The transfer failed. Try again.");
  });
});
