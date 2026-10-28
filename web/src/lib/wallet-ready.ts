"use client";

import { createContext, createElement, useContext, useSyncExternalStore, type ReactNode } from "react";
import type { Config } from "wagmi";

// With wagmi `ssr: true` the first client render reports "disconnected", and child effects run
// before wagmi's own Hydrate effect starts reconnect(). A guard that trusts that first snapshot
// would redirect a connected user to "/" on every reload. This store flips to ready only once
// wagmi's first connect or reconnect attempt has settled (or a grace period has passed).
type WagmiStatus = "connecting" | "reconnecting" | "connected" | "disconnected";

export type WalletReadyStore = {
  subscribe(cb: () => void): () => void;
  getSnapshot(): boolean;
};

export function createWalletReadyStore(
  config: Pick<Config, "state" | "subscribe">,
  graceMs = 4000,
): WalletReadyStore {
  let ready = false;
  let started = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopWagmi: (() => void) | undefined;
  const listeners = new Set<() => void>();

  function markReady() {
    if (ready) return;
    ready = true;
    if (timer !== undefined) clearTimeout(timer);
    stopWagmi?.();
    stopWagmi = undefined;
    listeners.forEach((l) => l());
  }

  // Lazy: runs on the first subscribe (a commit-phase effect), never during render.
  function start() {
    started = true;
    if (config.state.status === "connected") {
      markReady();
      return;
    }
    stopWagmi = config.subscribe(
      (s) => s.status as WagmiStatus,
      (status, previous) => {
        const settled = status === "connected" || status === "disconnected";
        const wasPending = previous === "connecting" || previous === "reconnecting";
        if (settled && wasPending) markReady();
      },
    );
    timer = setTimeout(markReady, graceMs);
  }

  return {
    subscribe(cb) {
      listeners.add(cb);
      if (!started) start();
      return () => {
        listeners.delete(cb);
      };
    },
    getSnapshot: () => ready,
  };
}

const WalletReadyContext = createContext<WalletReadyStore | null>(null);

export function WalletReadyProvider({ store, children }: { store: WalletReadyStore; children: ReactNode }) {
  return createElement(WalletReadyContext.Provider, { value: store }, children);
}

const neverReady: WalletReadyStore = { subscribe: () => () => {}, getSnapshot: () => false };

export function useWalletReady(): boolean {
  const store = useContext(WalletReadyContext) ?? neverReady;
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => false);
}
