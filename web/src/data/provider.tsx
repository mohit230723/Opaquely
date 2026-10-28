"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import type { DataLayer } from "./data-layer";
import type { DataScope, Hex } from "./types";
import { createStubDataLayer, stubControls, type SeedMode } from "./stub";

interface DataLayerContextValue {
  layer: DataLayer;
  scope: DataScope;
}

const DataLayerContext = createContext<DataLayerContextValue | null>(null);

export function DataLayerProvider({ children }: { children: ReactNode }) {
  const { address, chainId } = useAccount();

  const value = useMemo<DataLayerContextValue>(
    () => ({
      // The single factory call that Phases 4 and 5 replace with the real chain-backed layer.
      layer: createStubDataLayer({ address: address as Hex | undefined, chainId }),
      scope: { address: address as Hex | undefined, chainId, source: "stub" },
    }),
    [address, chainId],
  );

  return <DataLayerContext.Provider value={value}>{children}</DataLayerContext.Provider>;
}

function useDataLayerContext(): DataLayerContextValue {
  const ctx = useContext(DataLayerContext);
  if (!ctx) throw new Error("useDataLayer must be used inside DataLayerProvider.");
  return ctx;
}

export function useDataLayer(): DataLayer {
  return useDataLayerContext().layer;
}

export function useDataScope(): DataScope {
  return useDataLayerContext().scope;
}

export function useStubControls() {
  const { scope } = useDataLayerContext();
  const queryClient = useQueryClient();
  const snap = useSyncExternalStore(stubControls.subscribe, stubControls.getSnapshot, stubControls.getSnapshot);

  const setFailNext = useCallback((v: boolean) => stubControls.setFailNext(v), []);
  const setFailNextRead = useCallback(
    (v: boolean) => {
      stubControls.setFailNextRead(v);
      if (v) void queryClient.invalidateQueries();
    },
    [queryClient],
  );
  const setSeedMode = useCallback(
    (m: SeedMode) => {
      stubControls.setSeedMode(m);
      void queryClient.invalidateQueries();
    },
    [queryClient],
  );

  return {
    active: scope.source === "stub",
    failNext: snap.failNext,
    setFailNext,
    failNextRead: snap.failNextRead,
    setFailNextRead,
    seedMode: snap.seedMode,
    setSeedMode,
  };
}
