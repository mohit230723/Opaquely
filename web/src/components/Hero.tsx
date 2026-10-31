"use client";

import Image from "next/image";
import { GeistMono } from "geist/font/mono";
import GradientASCII from "./GradientASCII";
import { AnimatedHero } from "@/components/ui/animated-hero";
import { BRAND, EMBOSSED_RATIO } from "@/lib/brand";
import "./home/EmbossedWordmark.css";

// The hero top is near-white and the bottom near-black, so the copy sits over a scrim.
const FALLBACK_BACKGROUND = "linear-gradient(to bottom, #1e3fd8, #050816)";
const SCRIM_BACKGROUND = "linear-gradient(to top, #050816 0%, rgba(5,8,22,0.85) 55%, rgba(5,8,22,0) 100%)";

// Intrinsic size for next/image; CSS scales the embossed artwork down with the column.
const WORDMARK_WIDTH = 720;
const WORDMARK_HEIGHT = Math.round(WORDMARK_WIDTH / EMBOSSED_RATIO);

// -mt-16 pulls the hero up behind the fixed, transparent header (the layout's 64px spacer).
export function Hero() {
  return (
    <section className="relative -mt-16 min-h-[820px] w-full overflow-hidden" style={{ background: FALLBACK_BACKGROUND }}>
      {/* GradientASCII fills its parent, so it gets an absolute box the size of the (content-height) hero. */}
      <div aria-hidden="true" className="absolute inset-0">
      <GradientASCII
        colors={["#1e3fd8", "#f6f8ff", "#a5d8ff", "#38bdf8"]}
        shape="horizon"
        characters=" =+xX0S8#@"
        cellSize={18}
        density={0.8}
        fontFamily={GeistMono.style.fontFamily}
      />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%]"
        style={{ background: SCRIM_BACKGROUND }}
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-20 pt-40 sm:px-6">
        {/* Decorative artwork, not a heading: the animated tagline below is the page's only h1. */}
        <Image
          unoptimized
          priority
          src={BRAND.embossed}
          alt="Opaquely"
          width={WORDMARK_WIDTH}
          height={WORDMARK_HEIGHT}
          draggable={false}
          className="emboss-wordmark mb-12"
        />
        <AnimatedHero />
      </div>
    </section>
  );
}
