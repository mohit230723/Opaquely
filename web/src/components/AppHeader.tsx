"use client";

import Image from "next/image";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { SiteMenu } from "@/components/nav/SiteMenu";
import { SiteNav } from "@/components/nav/SiteNav";
import { BRAND, WORDMARK_RATIO } from "@/lib/brand";

const WORDMARK_HEIGHT = 40;

// Transparent and fixed over the page, so the home hero runs up behind it (the layout adds a 64px spacer
// that the hero pulls back). Three columns keep the nav centered on the viewport whatever the logo width.
// No backdrop-blur, transform, filter, contain or overflow-hidden here: the fixed menu overlay and the
// GooeyNav canvas (which reaches 72px past the nav) must position against the viewport, not the header.
export function AppHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 grid min-h-16 grid-cols-[1fr_auto_1fr] items-center gap-x-4 bg-transparent pl-4 pr-[120px] sm:pl-6">
      <Link href="/" aria-label="Opaquely" className="flex h-16 shrink-0 items-center justify-self-start">
        <Image
          src={BRAND.wordmark}
          alt="Opaquely"
          unoptimized
          priority
          width={Math.round(WORDMARK_HEIGHT * WORDMARK_RATIO)}
          height={WORDMARK_HEIGHT}
          className="hidden h-10 w-auto sm:block"
        />
        <Image src={BRAND.icon} alt="" unoptimized priority width={40} height={40} className="h-10 w-10 sm:hidden" />
      </Link>
      <SiteNav />
      {/* From 768px the wallet lives inside the nav pill; below that the nav is hidden, so it sits here. */}
      <div className="flex min-h-16 min-w-0 items-center justify-end gap-x-3 justify-self-end py-2 md:hidden">
        <ConnectButton showBalance={false} accountStatus={{ smallScreen: "avatar", largeScreen: "address" }} />
      </div>
      {/* Fixed overlay; its Menu toggle is drawn in the 120px reserved at the right of the header. */}
      <SiteMenu />
    </header>
  );
}
