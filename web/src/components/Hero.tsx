"use client";

import Image from "next/image";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { GeistMono } from "geist/font/mono";
import GradientASCII from "./GradientASCII";
import { Button } from "@/components/ui/Button";
import { BRAND, EMBOSSED_RATIO } from "@/lib/brand";
import "./home/EmbossedWordmark.css";

// The hero top is near-white and the bottom near-black, so the copy sits in the lower half over a scrim.
const FALLBACK_BACKGROUND = "linear-gradient(to bottom, #1e3fd8, #050816)";
const SCRIM_BACKGROUND = "linear-gradient(to top, #050816 0%, rgba(5,8,22,0.85) 45%, rgba(5,8,22,0) 100%)";

// Intrinsic size for next/image; CSS scales the embossed artwork down with the column.
const WORDMARK_WIDTH = 720;
const WORDMARK_HEIGHT = Math.round(WORDMARK_WIDTH / EMBOSSED_RATIO);

// -mt-16 pulls the hero up behind the fixed, transparent header (the layout's 64px spacer).
export function Hero() {
  const { isConnected } = useAccount();

  return (
    <section className="relative -mt-16 h-[760px] w-full overflow-hidden" style={{ background: FALLBACK_BACKGROUND }}>
      <GradientASCII
        colors={["#1e3fd8", "#f6f8ff", "#a5d8ff", "#38bdf8"]}
        shape="horizon"
        characters=" =+xX0S8#@"
        cellSize={18}
        density={0.8}
        fontFamily={GeistMono.style.fontFamily}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[420px]"
        style={{ background: SCRIM_BACKGROUND }}
      />
      <div className="absolute inset-x-0 bottom-0">
        <div className="mx-auto w-full max-w-6xl px-4 pb-14 sm:px-6">
          {/* Decorative artwork, not a heading: the tagline below stays the page's only h1. */}
          <Image
            unoptimized
            priority
            src={BRAND.embossed}
            alt="Opaquely"
            width={WORDMARK_WIDTH}
            height={WORDMARK_HEIGHT}
            draggable={false}
            className="emboss-wordmark mb-10"
          />
          <h1 className="text-[48px] font-semibold leading-[1.1] text-text">
            Your bills, encrypted. Insights, for sale.
          </h1>
          <p className="mt-4 max-w-[640px] text-lg text-brand-tint">
            Opaquely turns receipts into encrypted datasets. Buyers pay for aggregate insights and never see a single
            bill.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button variant="primary" href="/upload" size="lg">
              Upload
            </Button>
            <Button variant="secondary" href="/marketplace" size="lg">
              Browse marketplace
            </Button>
            {isConnected ? null : <ConnectButton showBalance={false} />}
          </div>
        </div>
      </div>
    </section>
  );
}
