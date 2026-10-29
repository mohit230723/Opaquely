"use client";

import Image from "next/image";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { NetworkBadge } from "@/components/NetworkBadge";
import { SiteMenu } from "@/components/nav/SiteMenu";
import { SiteNav } from "@/components/nav/SiteNav";
import { BRAND, WORDMARK_RATIO } from "@/lib/brand";

const WORDMARK_HEIGHT = 36;

// No backdrop-blur, transform, filter, contain or overflow-hidden here: the fixed menu overlay and the
// GooeyNav canvas (which reaches 72px past the nav) must position against the viewport, not the header.
export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 flex min-h-16 items-center gap-x-4 border-b border-border bg-surface pl-4 pr-[120px] sm:pl-6">
      <Link href="/" aria-label="Opaquely" className="flex h-16 shrink-0 items-center">
        <Image
          src={BRAND.wordmark}
          alt="Opaquely"
          unoptimized
          priority
          width={Math.round(WORDMARK_HEIGHT * WORDMARK_RATIO)}
          height={WORDMARK_HEIGHT}
          className="hidden h-9 w-auto sm:block"
        />
        <Image src={BRAND.icon} alt="" unoptimized priority width={40} height={40} className="h-10 w-10 sm:hidden" />
      </Link>
      <SiteNav />
      <div className="ml-auto flex min-h-16 min-w-0 items-center justify-end gap-x-3 py-2">
        <span className="hidden sm:inline-flex">
          <NetworkBadge />
        </span>
        <ConnectButton showBalance={false} accountStatus={{ smallScreen: "avatar", largeScreen: "address" }} />
      </div>
      {/* Fixed overlay; its Menu toggle is drawn in the 120px reserved at the right of the header. */}
      <SiteMenu />
    </header>
  );
}
