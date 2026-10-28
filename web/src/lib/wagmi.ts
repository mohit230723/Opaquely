import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { hardhat } from "wagmi/chains";

// Only ever called from a client component (providers.tsx), never from a Server Component.
export function getConfig() {
  return getDefaultConfig({
    appName: "Opaquely",
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo-project-id",
    chains: [hardhat],
    ssr: true,
  });
}
