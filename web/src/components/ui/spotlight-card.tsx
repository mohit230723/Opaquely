"use client";

// User-supplied GlowCard (21st.dev spotlight-card), ported in plan 07-03. Integration edits are marked OPAQUELY.
import { useEffect, type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode } from "react";
// OPAQUELY: the pseudo-element styles ship as an imported stylesheet instead of an injected style element.
import "./spotlight-card.css";

type GlowColor = "brand" | "blue" | "purple" | "green" | "red" | "orange";

interface GlowCardProps extends Omit<HTMLAttributes<HTMLElement>, "style"> {
  children: ReactNode;
  className?: string;
  glowColor?: GlowColor;
  size?: "sm" | "md" | "lg";
  width?: string | number;
  height?: string | number;
  customSize?: boolean; // When true, ignores size prop and uses width/height or className
  /** OPAQUELY: root element, for example "li" inside a list. */
  as?: ElementType;
}

const glowColorMap: Record<GlowColor, { base: number; spread: number }> = {
  // OPAQUELY: brand range, sky #38bdf8 (199deg) to brand blue #1e3fd8 (229deg and a little past); the default.
  brand: { base: 199, spread: 40 },
  blue: { base: 220, spread: 200 },
  purple: { base: 280, spread: 300 },
  green: { base: 120, spread: 200 },
  red: { base: 0, spread: 200 },
  orange: { base: 30, spread: 200 },
};

const sizeMap = {
  sm: "w-48 h-64",
  md: "w-64 h-80",
  lg: "w-80 h-96",
};

// OPAQUELY: one shared, rAF-throttled pointer listener for every card, writing --x/--y/--xp/--yp on the root
// element (the cards inherit them). Attached by the first mounted card, removed with the last one, and never
// attached under prefers-reduced-motion (the glow then stays static).
let mounted = 0;
let frame = 0;
let lastX = 0;
let lastY = 0;

function writePointer() {
  frame = 0;
  const root = document.documentElement.style;
  root.setProperty("--x", lastX.toFixed(2));
  root.setProperty("--xp", (lastX / window.innerWidth).toFixed(2));
  root.setProperty("--y", lastY.toFixed(2));
  root.setProperty("--yp", (lastY / window.innerHeight).toFixed(2));
}

function onPointerMove(e: PointerEvent) {
  lastX = e.clientX;
  lastY = e.clientY;
  if (!frame) frame = requestAnimationFrame(writePointer);
}

function attachPointer(): () => void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};
  mounted += 1;
  if (mounted === 1) document.addEventListener("pointermove", onPointerMove, { passive: true });
  return () => {
    mounted -= 1;
    if (mounted === 0) {
      document.removeEventListener("pointermove", onPointerMove);
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    }
  };
}

const GlowCard = ({
  children,
  className = "",
  glowColor = "brand",
  size = "md",
  width,
  height,
  customSize = false,
  as: Tag = "div",
  ...rest
}: GlowCardProps) => {
  useEffect(() => attachPointer(), []);

  const { base, spread } = glowColorMap[glowColor];

  // Determine sizing
  const getSizeClasses = () => {
    if (customSize) {
      return ""; // Let className or inline styles handle sizing
    }
    return sizeMap[size];
  };

  // OPAQUELY: typed so width and height (and the custom properties) type-check under strict TS.
  const getInlineStyles = () => {
    const baseStyles: CSSProperties & Record<`--${string}`, string | number> = {
      "--base": base,
      "--spread": spread,
      // OPAQUELY: 16px radius (rounded-2xl), #0b1230 at 72% body, #1b2550 resting border.
      "--radius": "16",
      "--border": "3",
      "--backdrop": "hsl(229 63% 12% / 0.72)",
      "--backup-border": "#1b2550",
      "--size": "200",
      "--outer": "1",
      "--border-size": "calc(var(--border, 2) * 1px)",
      "--spotlight-size": "calc(var(--size, 150) * 1px)",
      "--hue": "calc(var(--base) + (var(--xp, 0) * var(--spread, 0)))",
      backgroundImage: `radial-gradient(
        var(--spotlight-size) var(--spotlight-size) at
        calc(var(--x, 0) * 1px)
        calc(var(--y, 0) * 1px),
        hsl(var(--hue, 210) calc(var(--saturation, 100) * 1%) calc(var(--lightness, 70) * 1%) / var(--bg-spot-opacity, 0.1)), transparent
      )`,
      backgroundColor: "var(--backdrop, transparent)",
      backgroundSize: "calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)))",
      backgroundPosition: "50% 50%",
      backgroundAttachment: "fixed",
      border: "var(--border-size) solid var(--backup-border)",
      position: "relative",
      // OPAQUELY: auto, so a touch that starts on a card still scrolls the page.
      touchAction: "auto",
    };

    // Add width and height if provided
    if (width !== undefined) {
      baseStyles.width = typeof width === "number" ? `${width}px` : width;
    }
    if (height !== undefined) {
      baseStyles.height = typeof height === "number" ? `${height}px` : height;
    }

    return baseStyles;
  };

  return (
    <Tag
      {...rest}
      data-glow
      style={getInlineStyles()}
      className={`
          ${getSizeClasses()}
          ${!customSize ? "aspect-[3/4]" : ""}
          rounded-2xl
          relative
          grid
          grid-rows-[1fr_auto]
          shadow-[0_1rem_2rem_-1rem_black]
          p-4
          gap-4
          backdrop-blur-[5px]
          ${className}
        `}
    >
      <div data-glow aria-hidden="true"></div>
      {children}
    </Tag>
  );
};

export { GlowCard };
