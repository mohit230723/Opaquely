import Link from "next/link";
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import { SpinnerIcon } from "@/components/icons";

export type ButtonVariant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-4 text-base font-semibold transition-colors duration-150";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-[#f6f8ff] hover:bg-accent-hover",
  secondary: "border border-border-strong bg-transparent text-text hover:bg-surface-raised",
  ghost: "bg-transparent text-text hover:bg-surface-raised",
};

const disabledClass = "cursor-not-allowed bg-surface-raised text-muted hover:bg-surface-raised";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> {
  variant?: ButtonVariant;
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
  const classes = `${base} ${blocked ? disabledClass : variants[variant]} ${className}`.trim();
  const content = (
    <>
      {loading ? <SpinnerIcon /> : null}
      {children}
    </>
  );

  if (href !== undefined) {
    return (
      <Link
        href={href}
        className={classes}
        aria-disabled={blocked || undefined}
        aria-busy={loading || undefined}
        onClick={(e: MouseEvent<HTMLAnchorElement>) => {
          if (blocked) {
            e.preventDefault();
            return;
          }
          (onClick as unknown as ((e: MouseEvent<HTMLAnchorElement>) => void) | undefined)?.(e);
        }}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      {...rest}
      type={type}
      className={classes}
      aria-disabled={blocked || undefined}
      aria-busy={loading || undefined}
      onClick={(e) => {
        if (blocked) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
    >
      {content}
    </button>
  );
}
