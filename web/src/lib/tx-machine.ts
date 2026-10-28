import type { Hex, TxReceipt } from "@/data/types";

export type TxErrorCode = "user_rejected" | "reverted" | "wrong_network" | "unknown";

export type TxState =
  | { phase: "idle" }
  | { phase: "awaiting_signature"; run: number }
  | { phase: "pending"; run: number; hash: Hex }
  | { phase: "confirmed"; run: number; hash: Hex; receipt: TxReceipt }
  | { phase: "failed"; run: number; hash?: Hex; reason: string; code: TxErrorCode };

export type TxEvent =
  | { type: "start"; run: number }
  | { type: "signed"; run: number; hash: Hex }
  | { type: "confirmed"; run: number; receipt: TxReceipt }
  | { type: "failed"; run: number; reason: string; code: TxErrorCode }
  | { type: "reset" };

export const initialTxState: TxState = { phase: "idle" };

/**
 * Pure transaction state machine. Every event except start and reset carries the run id of the
 * send that produced it. An event from an older run (a late receipt after the user retried) is
 * dropped by returning the same state object, so React skips the re-render.
 */
export function txReducer(state: TxState, event: TxEvent): TxState {
  if (event.type === "reset") return initialTxState;
  if (event.type === "start") return { phase: "awaiting_signature", run: event.run };

  if (state.phase === "idle" || state.run !== event.run) return state;

  switch (event.type) {
    case "signed":
      return state.phase === "awaiting_signature" ? { phase: "pending", run: state.run, hash: event.hash } : state;
    case "confirmed":
      return state.phase === "pending"
        ? { phase: "confirmed", run: state.run, hash: state.hash, receipt: event.receipt }
        : state;
    case "failed":
      if (state.phase === "awaiting_signature") {
        return { phase: "failed", run: state.run, reason: event.reason, code: event.code };
      }
      if (state.phase === "pending") {
        return { phase: "failed", run: state.run, hash: state.hash, reason: event.reason, code: event.code };
      }
      return state;
  }
}

/** True while the user is signing or the transaction is waiting for a receipt. */
export function isBusy(state: TxState): boolean {
  return state.phase === "awaiting_signature" || state.phase === "pending";
}
