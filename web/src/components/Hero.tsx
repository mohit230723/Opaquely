"use client";

import { GeistMono } from "geist/font/mono";
import GradientASCII from "./GradientASCII";
import { AnimatedHero } from "@/components/ui/animated-hero";

// The hero top is near-white and the bottom near-black, so the copy sits over a scrim.
// The ASCII field fades out downward into the site backdrop, and a soft radial scrim keeps the copy legible.
const ASCII_MASK = "linear-gradient(to bottom, #000 0%, #000 35%, transparent 92%)";
const SCRIM_BACKGROUND = "radial-gradient(ellipse 60% 55% at 50% 58%, rgba(5,8,22,0.82) 0%, rgba(5,8,22,0.45) 55%, rgba(5,8,22,0) 100%)";

// -mt-16 pulls the hero up behind the fixed, transparent header (the layout's 64px spacer).
export function Hero() {
  return (
    <section className="relative -mt-16 flex min-h-dvh w-full items-center overflow-hidden">
      {/* GradientASCII fills its parent, so it gets an absolute box the size of the (content-height) hero. */}
      <div aria-hidden="true" className="absolute inset-0 opacity-90" style={{ WebkitMaskImage: ASCII_MASK, maskImage: ASCII_MASK }}>
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
        className="pointer-events-none absolute inset-0"
        style={{ background: SCRIM_BACKGROUND }}
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-16 pt-28 sm:px-6">
        <AnimatedHero />
      </div>
    </section>
  );
}
