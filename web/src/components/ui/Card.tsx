import type { ElementType, HTMLAttributes, ReactNode } from "react";
import TiltedCard from "@/components/ui/TiltedCard";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Render as another element, for example "li" or "section". */
  as?: ElementType;
  /**
   * A display card (home, marketplace, datasets, account stats): the full React Bits tilt, lift and glare.
   * Without it the card still tilts, but gently, because it usually holds a form. Pass at most two children:
   * one content block and an optional footer.
   */
  glow?: boolean;
  children: ReactNode;
}

/**
 * Every card in the app is the user's TiltedCard (React Bits), sized by its content (`tilted-card--fluid`):
 * 16px radius, dark brand face, 24px padding (16px under 640px). The `as` element is the host that carries
 * list semantics, test ids and layout classes; the card itself is purely visual (no flip, no click, no
 * tooltip, no gyroscope prompt), so links and buttons inside it work as before.
 */
export function Card({ as: Tag = "div", glow = false, className = "", style, children, ...rest }: CardProps) {
  return (
    <Tag {...rest} style={style} className={`block ${className}`.trim()}>
      <TiltedCard
        className="tilted-card--fluid"
        containerWidth="100%"
        containerHeight="100%"
        imageWidth="100%"
        imageHeight="100%"
        radius={16}
        rotateAmplitude={glow ? 10 : 3}
        scaleOnHover={glow ? 1.03 : 1}
        glare={glow ? 0.45 : 0.18}
        glareColor="#a5d8ff"
        shadow={glow ? 0.6 : 0.35}
        perspective={900}
        showTooltip={false}
        gyroscope={false}
        intro={glow}
      >
        <div className="tilted-card__content">{children}</div>
      </TiltedCard>
    </Tag>
  );
}
