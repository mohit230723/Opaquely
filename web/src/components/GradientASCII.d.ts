import type { ComponentType, CSSProperties, HTMLAttributes } from "react";

// Types for the vendored React Bits GradientASCII.jsx. Every prop is optional because the
// component supplies defaults in its JS destructuring.
export type GradientASCIIShape = "horizon" | "pinch" | "rise" | "eclipse";
export type GradientASCIIClickEffect = "none" | "wave" | "burst";

export type GradientASCIIProps = {
  colors?: string[];
  shape?: GradientASCIIShape;
  characters?: string;
  cellSize?: number;
  density?: number;
  glyphOpacity?: number;
  glow?: number;
  depthOfField?: number;
  flicker?: number;
  softness?: number;
  scale?: number;
  flow?: number;
  speed?: number;
  gradientOpacity?: number;
  grain?: number;
  variation?: number;
  mouseInteraction?: boolean;
  scrambleRadius?: number;
  clickEffect?: GradientASCIIClickEffect;
  intro?: boolean;
  lightMode?: boolean;
  fontFamily?: string;
  dpr?: number;
  className?: string;
  style?: CSSProperties;
} & HTMLAttributes<HTMLDivElement>;

declare const GradientASCII: ComponentType<GradientASCIIProps>;
export default GradientASCII;
