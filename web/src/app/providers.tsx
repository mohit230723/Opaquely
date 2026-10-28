"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { getConfig } from "@/lib/wagmi";
import { DataLayerProvider } from "@/data/provider";

export function Providers({ children }: { children: ReactNode }) {
  // Created lazily inside the component, never at module level.
  const [config] = useState(() => getConfig());
  // Retries are off in Phase 1 so a stub read failure shows its error state at once.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
      }),
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({ accentColor: "#1e3fd8" })}>
          <DataLayerProvider>{children}</DataLayerProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
