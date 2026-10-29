"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import { SpinnerIcon } from "@/components/icons";
import SpecularButton from "@/components/ui/SpecularButton";

export type ButtonVariant = "primary" | "secondary" | "ghost";

// Ghost stays CSS-only (no WebGL): transparent, 18px radius, 44px tall.
const ghostBase =
  "inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-[18px] px-4 text-base font-semibold text-[#f5f5f5] transition-colors duration-150 hover:bg-[rgba(255,255,255,0.08)]";
const ghostBlocked = "cursor-not-allowed text-[#9fb0d6] hover:bg-transparent";

// The user's SpecularButton look (D-16): glass body, only the two light colors branded. Primary and secondary
// differ by idle shimmer (and size and placement), never by fill.
const IDLE: Record<"primary" | "secondary", number> = { primary: 0.35, secondary: 0.2 };

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> {
  variant?: ButtonVariant;
  /** md (44px) in forms, cards and dialogs; lg (56px) for the home hero and closing CTAs. */
  size?: "md" | "lg";
  /** Shows a spinner and sets aria-busy. Activation is blocked while loading. */
  loading?: boolean;
  /** Uses aria-disabled: stays focusable and blocks activation. Show the reason in text nearby. */
  disabled?: boolean;
  /** Renders a Next Link instead of a button. */
  href?: string;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  href,
  className = "",
  onClick,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const blocked = disabled || loading;
  const content = (
    <>
      {loading ? <SpinnerIcon /> : null}
      {children}
    </>
  );
  // Never the native disabled attribute: the control stays focusable and the handler blocks activation.
  const aria = {
    "aria-disabled": blocked ? ("true" as const) : undefined,
    "aria-busy": loading ? ("true" as const) : undefined,
  };
  const guard = (e: MouseEvent<HTMLElement>) => {
    if (blocked) {
      e.preventDefault();
      return;
    }
    (onClick as unknown as ((e: MouseEvent<HTMLElement>) => void) | undefined)?.(e);
  };

  if (variant === "ghost") {
    const classes = `${ghostBase} ${blocked ? ghostBlocked : ""} ${className}`.trim();
    if (href !== undefined) {
      return (
        <Link href={href} className={classes} data-variant="ghost" {...aria} onClick={guard}>
          {content}
        </Link>
      );
    }
    return (
      <button {...rest} type={type} className={classes} data-variant="ghost" {...aria} onClick={guard}>
        {content}
      </button>
    );
  }

  return (
    <SpecularButton
      {...(href === undefined ? rest : {})}
      href={href}
      type={type}
      size={size}
      radius={18}
      tint="#ffffff"
      tintOpacity={0.04}
      textColor="#f5f5f5"
      lineColor="#a5d8ff"
      baseColor="#5b6fb0"
      intensity={1}
      idleIntensity={IDLE[variant]}
      shineSize={10}
      shineFade={34}
      thickness={1.2}
      glow={1}
      followMouse
      proximity={250}
      className={className}
      data-variant={variant}
      {...aria}
      onClick={guard}
    >
      {content}
    </SpecularButton>
  );
}
