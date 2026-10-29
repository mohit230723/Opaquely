"use client";

import { usePathname } from "next/navigation";
import GooeyNav from "@/components/ui/GooeyNav";
import { NAV, activeIndex } from "@/lib/nav";

// GooeyNav parses hex and rgba() only, so every color here is one of those.
const NAV_STYLE = {
  "--gn-frame": "rgba(11,18,48,0.7)",
  "--gn-frame-edge": "rgba(165,216,255,0.14)",
  "--gn-frame-highlight": "rgba(165,216,255,0.10)",
  "--gn-ink": "#f6f8ff",
  "--gn-muted": "#9fb0d6",
};

/** The Primary nav from 768px: the vendored GooeyNav, active item from the pathname (none on /). */
export function SiteNav() {
  const current = activeIndex(usePathname());

  return (
    <div className="hidden min-w-0 flex-1 justify-center md:flex">
      <GooeyNav
        items={[...NAV]}
        activeIndex={current}
        aria-label="Primary"
        theme="dark"
        size="md"
        frame
        particleCount={15}
        spread={56}
        animationTime={600}
        timeVariance={300}
        gooeyness={0.5}
        wobble={0.5}
        hoverEffect
        color="#1e3fd8"
        activeTextColor="#f6f8ff"
        colors={["#1e3fd8", "#38bdf8"]}
        style={NAV_STYLE}
      />
    </div>
  );
}
