import Image from "next/image";
import { BRAND, EMBOSSED_RATIO } from "@/lib/brand";
import "./EmbossedWordmark.css";

// Intrinsic size for next/image; CSS scales it to min(100%, 960px) wide with the height following.
const WIDTH = 960;
const HEIGHT = Math.round(WIDTH / EMBOSSED_RATIO);

// Decorative artwork, not a heading: the hero tagline stays the page's only h1. No glow card and no
// transformed ancestor, so the drop-shadow relief renders against the flat dark band.
export function EmbossedWordmark() {
  return (
    <section className="w-full bg-bg">
      <div className="mx-auto flex w-full max-w-6xl justify-center px-4 py-16 sm:px-6">
        <Image
          unoptimized
          src={BRAND.embossed}
          alt="Opaquely"
          width={WIDTH}
          height={HEIGHT}
          draggable={false}
          className="emboss-wordmark"
        />
      </div>
    </section>
  );
}
