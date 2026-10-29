"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { BillDraft } from "@/data/types";

// Plaintext bill drafts for this tab only, so the chain-vs-you panel can show what the seller typed
// beside the ciphertext handles. A module-level Map: it survives client-side navigation between
// routes and is gone after a reload. Never written to disk, never logged, never sent anywhere.

export interface SessionBill {
  index: number;
  draft: BillDraft;
}

const EMPTY: readonly SessionBill[] = Object.freeze([]);

const entries = new Map<string, SessionBill[]>();
const snapshots = new Map<string, readonly SessionBill[]>();
const listeners = new Set<() => void>();

function keyOf(address: string, datasetId: string): string {
  return `${address.toLowerCase()}|${datasetId}`;
}

export function recordSessionBill(address: string, datasetId: string, entry: SessionBill): void {
  const key = keyOf(address, datasetId);
  const rows = (entries.get(key) ?? []).filter((r) => r.index !== entry.index);
  rows.push({ index: entry.index, draft: { ...entry.draft } });
  rows.sort((a, b) => a.index - b.index);
  entries.set(key, rows);
  snapshots.set(key, Object.freeze([...rows])); // a new array identity only when this key changed
  listeners.forEach((cb) => cb());
}

export function getSessionBills(address: string, datasetId: string): readonly SessionBill[] {
  return snapshots.get(keyOf(address, datasetId)) ?? EMPTY;
}

export function subscribeSessionBills(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useSessionBills(address: string | undefined, datasetId: string): readonly SessionBill[] {
  const getSnapshot = useCallback(
    () => (address ? getSessionBills(address, datasetId) : EMPTY),
    [address, datasetId],
  );
  return useSyncExternalStore(subscribeSessionBills, getSnapshot, () => EMPTY);
}

/** Tests only. */
export function clearSessionBills(): void {
  entries.clear();
  snapshots.clear();
  listeners.forEach((cb) => cb());
}

/**
 * Categories to declare on a listing: these become public listing data. They are known only while
 * this tab holds EVERY bill of the dataset, so a reload or bills added elsewhere means "unknown"
 * (empty, mask 0). More rows than the chain count means stale rows (a node restart without a
 * reload), which is also unknown.
 */
export function declaredCategories(address: string, datasetId: string, billCount: number): number[] {
  const rows = getSessionBills(address, datasetId);
  if (billCount <= 0 || rows.length !== billCount) return [];
  return [...new Set(rows.map((r) => r.draft.category))].sort((a, b) => a - b);
}
