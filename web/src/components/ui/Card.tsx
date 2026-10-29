import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { GlowCard } from "@/components/ui/spotlight-card";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Render as another element, for example "li" or "section". */
  as?: ElementType;
  /**
   * Render the user's GlowCard (pointer spotlight in the brand hue range) instead of the flat card. Pass at most
   * two children: one content block and an optional footer.
   */
  glow?: boolean;
  children: ReactNode;
}

/** Surface card: 16px radius, 1px border, 24px padding (16px under 640px). `glow` makes it a GlowCard. */
export function Card({ as: Tag = "div", glow = false, className = "", style, children, ...rest }: CardProps) {
  if (glow) {
    return (
      <GlowCard {...rest} as={Tag} customSize className={`sm:p-6 ${className}`.trim()}>
        {children}
      </GlowCard>
    );
  }
  return (
    <Tag {...rest} style={style} className={`rounded-2xl border border-border bg-surface p-4 sm:p-6 ${className}`.trim()}>
      {children}
    </Tag>
  );
}
