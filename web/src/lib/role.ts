"use client";

import { useSyncExternalStore } from "react";

// The role is a UI view mode chosen per wallet address, not an authorization source.
// Real access control stays on-chain. This is the only module allowed to touch browser storage.
export type Role = "seller" | "buyer";

export function roleStorageKey(address: string): string {
  return `opaquely:role:${address.toLowerCase()}`;
}

const listeners = new Set<() => void>();

export function subscribeRole(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function getStoredRole(address: string): Role | null {
  try {
    const value = localStorage.getItem(roleStorageKey(address));
    return value === "seller" || value === "buyer" ? value : null;
  } catch {
    return null;
  }
}

export function setRole(address: string, role: Role): void {
  try {
    localStorage.setItem(roleStorageKey(address), role);
  } catch {
    // Storage unavailable: the choice just will not persist.
  }
  listeners.forEach((l) => l());
}

function subscribeBrowser(cb: () => void): () => void {
  const off = subscribeRole(cb);
  window.addEventListener("storage", cb);
  return () => {
    off();
    window.removeEventListener("storage", cb);
  };
}

/** undefined on the server and before hydration, null when no role is stored (or no address). */
export function useRole(address?: string): Role | null | undefined {
  return useSyncExternalStore(
    subscribeBrowser,
    () => (address ? getStoredRole(address) : null),
    () => undefined,
  );
}
