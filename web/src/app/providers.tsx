"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { getConfig } from "@/lib/wagmi";
import { chainPollInterval } from "@/data/polling";
import { DataLayerProvider } from "@/data/provider";
import { WalletReadyProvider, createWalletReadyStore } from "@/lib/wallet-ready";

export function Providers({ children }: { children: ReactNode }) {
  // Created lazily inside the component, never at module level.
  const [config] = useState(() => getConfig());
  // Retries stay off so a read failure shows its error state at once. Chain reads that another wallet can
  // change poll every 4 s (data/polling.ts); stub reads never poll. Nothing keeps the previous key's data on
  // screen, so after an account switch the new wallet sees a skeleton, never the old wallet's access.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false,
            refetchInterval: (query) => chainPollInterval(query.queryKey),
          },
        },
      }),
  );

  // Subscribes lazily (on first use in a client effect), so creating it here is render-safe.
  const [walletReady] = useState(() => createWalletReadyStore(config));

  return (
    <WagmiProvider config={config}>
      <WalletReadyProvider store={walletReady}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider theme={darkTheme({ accentColor: "#1e3fd8" })}>
            <DataLayerProvider>{children}</DataLayerProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WalletReadyProvider>
    </WagmiProvider>
  );
}
