import type { ReactNode } from "react";
import { WalletGate } from "@/components/WalletGate";

// The still-live /sell/datasets/[id] pages (detail, add, list, chain-view) until plan 07-04 folds them
// into Upload: gated by wallet connection only, like every other wallet page.
export default function SellerLayout({ children }: { children: ReactNode }) {
  return <WalletGate>{children}</WalletGate>;
}
