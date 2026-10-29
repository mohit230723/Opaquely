"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useAccount, useConfig } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import type { DataLayer } from "./data-layer";
import type { DataScope, Hex } from "./types";
import { createStubDataLayer, stubControls, type SeedMode } from "./stub";
import { createLiveDataLayer } from "./live";
import { resolveDataSource } from "./data-source";

interface DataLayerContextValue {
  layer: DataLayer;
  scope: DataScope;
}

const DataLayerContext = createContext<DataLayerContextValue | null>(null);

export function DataLayerProvider({ children }: { children: ReactNode }) {
  const { address, chainId } = useAccount();
  const config = useConfig();

  const value = useMemo<DataLayerContextValue>(() => {
    const source = resolveDataSource(chainId);
    const who = address as Hex | undefined;
    return {
      // The one switch between the mock marketplace and the real contracts. See data-source.ts.
      layer:
        source === "chain" && chainId !== undefined
          ? createLiveDataLayer({ config, address: who, chainId })
          : createStubDataLayer({ address: who, chainId }),
      scope: { address: who, chainId, source },
    };
  }, [address, chainId, config]);

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
