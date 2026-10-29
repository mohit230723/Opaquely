import type { ComponentType, CSSProperties, ReactNode } from "react";

// Types for the vendored React Bits GooeyNav.jsx (plan 07-02). Every prop is optional because the
// component supplies defaults in its JS destructuring.
export type GooeyNavItem = { label: string; href?: string; icon?: ReactNode };

export type GooeyNavProps = {
  items?: readonly GooeyNavItem[] | GooeyNavItem[];
  initialActiveIndex?: number;
  /** Controlled active item; -1 means none is active. */
  activeIndex?: number;
  onChange?: (index: number, item: GooeyNavItem) => void;
  theme?: "dark" | "light";
  color?: string;
  activeTextColor?: string;
  colors?: string[];
  size?: "sm" | "md" | "lg";
  frame?: boolean;
  animationTime?: number;
  particleCount?: number;
  timeVariance?: number;
  spread?: number;
  gooeyness?: number;
  wobble?: number;
  hoverEffect?: boolean;
  className?: string;
  style?: CSSProperties & Record<string, string | number>;
  "aria-label"?: string;
};

declare const GooeyNav: ComponentType<GooeyNavProps>;
export default GooeyNav;
