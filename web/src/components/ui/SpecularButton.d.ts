import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ComponentType, CSSProperties, ReactNode } from "react";

// Types for the vendored React Bits SpecularButton.jsx (plan 07-03). Every prop is optional because the
// component supplies defaults in its JS destructuring. Unknown props (aria-*, data-*) pass through.
export type SpecularButtonProps = {
  children?: ReactNode;
  size?: "sm" | "md" | "lg";
  radius?: number;
  tint?: string;
  tintOpacity?: number;
  blur?: number;
  textColor?: string;
  lineColor?: string;
  baseColor?: string;
  intensity?: number;
  idleIntensity?: number;
  shineSize?: number;
  shineFade?: number;
  thickness?: number;
  glow?: number;
  speed?: number;
  followMouse?: boolean;
  proximity?: number;
  autoAnimate?: boolean;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
  style?: CSSProperties | (CSSProperties & Record<string, string | number>);
  /** Renders a next/link with the same look instead of a button. */
  href?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "style" | "type" | "disabled"> &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "style" | "type" | "href" | keyof ButtonHTMLAttributes<HTMLButtonElement>> & {
    [dataAttribute: `data-${string}`]: string | undefined;
  };

declare const SpecularButton: ComponentType<SpecularButtonProps>;
export default SpecularButton;
