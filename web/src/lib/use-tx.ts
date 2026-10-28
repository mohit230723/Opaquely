"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { TxHandle, TxReceipt } from "@/data/types";
import { toReadableError } from "./tx-errors";
import { initialTxState, isBusy, txReducer, type TxState } from "./tx-machine";

export interface UseTxOptions<I> {
  /** Runs after a successful receipt and before the panel shows "confirmed" (query invalidation lives here). */
  onConfirmed?: (receipt: TxReceipt, input: I) => void | Promise<void>;
}

export interface UseTx<I> {
  state: TxState;
  run(input: I): Promise<void>;
  reset(): void;
}

/**
 * Drives one write from a DataLayer method: start, signed, confirmed or failed.
 * Every dispatch carries the run number, so a completion from an older run (after a retry or a
 * reset) is dropped by the reducer instead of overwriting what the user sees.
 */
export function useTx<I>(send: (input: I) => Promise<TxHandle>, opts?: UseTxOptions<I>): UseTx<I> {
  const [state, dispatch] = useReducer(txReducer, initialTxState);
  const runRef = useRef(0);
  const stateRef = useRef(state);
  const sendRef = useRef(send);
  const onConfirmedRef = useRef(opts?.onConfirmed);
  const onConfirmed = opts?.onConfirmed;

  useEffect(() => {
    stateRef.current = state;
    sendRef.current = send;
    onConfirmedRef.current = onConfirmed;
  });

  const run = useCallback(async (input: I) => {
    if (isBusy(stateRef.current)) return;
    const id = ++runRef.current;
    dispatch({ type: "start", run: id });

    let handle: TxHandle;
    try {
      handle = await sendRef.current(input);
    } catch (e) {
      dispatch({ type: "failed", run: id, ...toReadableError(e) });
      return;
    }
    dispatch({ type: "signed", run: id, hash: handle.hash });

    let receipt: TxReceipt;
    try {
      receipt = await handle.wait();
    } catch (e) {
      dispatch({ type: "failed", run: id, ...toReadableError(e) });
      return;
    }
    if (receipt.status === "reverted") {
      dispatch({ type: "failed", run: id, reason: "Transaction reverted.", code: "reverted" });
      return;
    }

    try {
      await onConfirmedRef.current?.(receipt, input);
    } catch {
      // The transaction itself confirmed. A failed cache refresh must not turn it into a failure;
      // the next query refetch shows the new state.
    }
    dispatch({ type: "confirmed", run: id, receipt });
  }, []);

  const reset = useCallback(() => {
    runRef.current += 1; // anything still in flight now belongs to an older run
    dispatch({ type: "reset" });
  }, []);

  return { state, run, reset };
}
