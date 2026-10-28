import type { ElementType, HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Render as another element, for example "li" or "section". */
  as?: ElementType;
  children: ReactNode;
}

/** Surface card: no shadow, 1px border, 24px padding (16px under 640px). */
export function Card({ as: Tag = "div", className = "", children, ...rest }: CardProps) {
  return (
    <Tag {...rest} className={`rounded-xl border border-border bg-surface p-4 sm:p-6 ${className}`.trim()}>
      {children}
    </Tag>
  );
}
