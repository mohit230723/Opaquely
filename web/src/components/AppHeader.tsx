"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { NetworkBadge } from "@/components/NetworkBadge";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
      <Link href="/" className="text-base font-semibold text-text">
        Opaquely
      </Link>
      <div className="flex items-center gap-4">
        <NetworkBadge />
        <ConnectButton showBalance={false} accountStatus={{ smallScreen: "avatar", largeScreen: "address" }} />
      </div>
    </header>
  );
}
