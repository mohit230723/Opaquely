import type { ReactNode } from "react";
import { WalletGate } from "@/components/WalletGate";

// The one place the wallet gate is mounted: every wallet page is wrapped once.
export default function AppLayout({ children }: { children: ReactNode }) {
  return <WalletGate>{children}</WalletGate>;
}
