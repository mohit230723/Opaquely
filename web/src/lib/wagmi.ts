import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http, type Config } from "wagmi";
import { hardhat, sepolia } from "wagmi/chains";
import { sepoliaFlagOn } from "./network";

// Only ever called from a client component (providers.tsx), never from a Server Component.
export function getConfig(): Config {
  const appName = "Opaquely";
  const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo-project-id";
  if (!sepoliaFlagOn()) {
    return getDefaultConfig({
      appName,
      projectId,
      chains: [hardhat],
      ssr: true,
    });
  }
  // Wagmi lists Sepolia whenever the flag is on so the wallet can switch to it. Whether the app supports
  // it is decided by supportedChainIds() (the flag AND a deployment). An empty RPC variable falls back to
  // viem's default Sepolia RPC. NEXT_PUBLIC values are public, so the URL must be keyless (see README).
  return getDefaultConfig({
    appName,
    projectId,
    chains: [hardhat, sepolia],
    transports: {
      [hardhat.id]: http(),
      [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || undefined),
    },
    ssr: true,
  });
}
