"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { NetworkBadge } from "@/components/NetworkBadge";
import { SiteNav } from "@/components/nav/SiteNav";

// No backdrop-blur, transform, filter or overflow-hidden here: the fixed menu overlay and the nav
// canvas (plan 07-02) must position against the viewport, not the header.
export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 flex min-h-16 flex-wrap items-center gap-x-4 border-b border-border bg-surface px-4 sm:px-6 md:flex-nowrap">
      <Link href="/" className="flex h-16 items-center text-base font-semibold text-text">
        Opaquely
      </Link>
      <SiteNav />
      <div className="ml-auto flex min-h-16 min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-2 py-2">
        <NetworkBadge />
        <ConnectButton showBalance={false} accountStatus={{ smallScreen: "avatar", largeScreen: "address" }} />
      </div>
    </header>
  );
}
