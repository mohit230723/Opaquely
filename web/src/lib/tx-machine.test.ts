import { describe, expect, it } from "vitest";
import { initialTxState, isBusy, txReducer, type TxState } from "./tx-machine";
import type { Hex, TxReceipt } from "@/data/types";

const HASH = `0x${"ab".repeat(32)}` as Hex;
const RECEIPT: TxReceipt = { status: "success", blockNumber: 7n, createdId: "x" };

describe("txReducer", () => {
  it("starts idle", () => {
    expect(initialTxState).toEqual({ phase: "idle" });
  });

  it("idle + start moves to awaiting_signature with the run id", () => {
    expect(txReducer(initialTxState, { type: "start", run: 1 })).toEqual({ phase: "awaiting_signature", run: 1 });
  });

  it("awaiting_signature + signed moves to pending with the hash", () => {
    const s = txReducer({ phase: "awaiting_signature", run: 1 }, { type: "signed", run: 1, hash: HASH });
    expect(s).toEqual({ phase: "pending", run: 1, hash: HASH });
  });

  it("pending + confirmed keeps the hash and carries the receipt", () => {
    const s = txReducer({ phase: "pending", run: 1, hash: HASH }, { type: "confirmed", run: 1, receipt: RECEIPT });
    expect(s).toEqual({ phase: "confirmed", run: 1, hash: HASH, receipt: RECEIPT });
  });

  it("failed from awaiting_signature has no hash", () => {
    const s = txReducer(
      { phase: "awaiting_signature", run: 1 },
      { type: "failed", run: 1, reason: "nope", code: "user_rejected" },
    );
    expect(s).toEqual({ phase: "failed", run: 1, reason: "nope", code: "user_rejected" });
  });

  it("failed from pending keeps the hash", () => {
    const s = txReducer(
      { phase: "pending", run: 1, hash: HASH },
      { type: "failed", run: 1, reason: "Transaction reverted.", code: "reverted" },
    );
    expect(s).toEqual({ phase: "failed", run: 1, hash: HASH, reason: "Transaction reverted.", code: "reverted" });
  });

  it("drops events whose run id differs from the current run", () => {
    const current: TxState = { phase: "awaiting_signature", run: 2 };
    expect(txReducer(current, { type: "signed", run: 1, hash: HASH })).toBe(current);
    expect(txReducer(current, { type: "failed", run: 1, reason: "late", code: "unknown" })).toBe(current);
    const pending: TxState = { phase: "pending", run: 2, hash: HASH };
    expect(txReducer(pending, { type: "confirmed", run: 1, receipt: RECEIPT })).toBe(pending);
  });

  it("ignores a late result from an old run after a retry began", () => {
    let s = txReducer(initialTxState, { type: "start", run: 1 });
    s = txReducer(s, { type: "failed", run: 1, reason: "first", code: "unknown" });
    s = txReducer(s, { type: "start", run: 2 });
    s = txReducer(s, { type: "confirmed", run: 1, receipt: RECEIPT });
    expect(s).toEqual({ phase: "awaiting_signature", run: 2 });
  });

  it("ignores signed or confirmed events that arrive in the wrong phase", () => {
    const idle = initialTxState;
    expect(txReducer(idle, { type: "signed", run: 0, hash: HASH })).toBe(idle);
    const awaiting: TxState = { phase: "awaiting_signature", run: 1 };
    expect(txReducer(awaiting, { type: "confirmed", run: 1, receipt: RECEIPT })).toBe(awaiting);
  });

  it("reset returns to idle from any phase", () => {
    expect(txReducer({ phase: "pending", run: 3, hash: HASH }, { type: "reset" })).toEqual({ phase: "idle" });
    expect(
      txReducer({ phase: "failed", run: 3, reason: "x", code: "unknown" }, { type: "reset" }),
    ).toEqual({ phase: "idle" });
  });

  it("a new start from failed or confirmed begins the next run", () => {
    const failed: TxState = { phase: "failed", run: 1, reason: "x", code: "unknown" };
    expect(txReducer(failed, { type: "start", run: 2 })).toEqual({ phase: "awaiting_signature", run: 2 });
    const done: TxState = { phase: "confirmed", run: 1, hash: HASH, receipt: RECEIPT };
    expect(txReducer(done, { type: "start", run: 2 })).toEqual({ phase: "awaiting_signature", run: 2 });
  });
});

describe("isBusy", () => {
  it("is true only while awaiting a signature or pending", () => {
    expect(isBusy({ phase: "idle" })).toBe(false);
    expect(isBusy({ phase: "awaiting_signature", run: 1 })).toBe(true);
    expect(isBusy({ phase: "pending", run: 1, hash: HASH })).toBe(true);
    expect(isBusy({ phase: "confirmed", run: 1, hash: HASH, receipt: RECEIPT })).toBe(false);
    expect(isBusy({ phase: "failed", run: 1, reason: "x", code: "unknown" })).toBe(false);
  });
});
