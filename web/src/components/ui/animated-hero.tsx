"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MoveDown, MoveRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

// Adapted from the 21st.dev animated-hero: the project's own specular Button replaces the shadcn button
// (a lowercase ui/button.tsx would collide with ui/Button.tsx on Windows), and the copy is Opaquely's.
const TITLES = ["encrypted", "private", "unseen", "sealed", "yours"];

/** Centered hero copy with a word that rotates every 2 s (held on the first word under reduced motion). */
function AnimatedHero() {
  const [titleNumber, setTitleNumber] = useState(0);
  const titles = useMemo(() => TITLES, []);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const timeoutId = setTimeout(() => {
      setTitleNumber(titleNumber === titles.length - 1 ? 0 : titleNumber + 1);
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [titleNumber, titles, reduceMotion]);

  return (
    <div className="flex w-full flex-col items-center justify-center gap-8">
      <Button variant="secondary" href="#how-it-works">
        See how it works <MoveDown aria-hidden="true" className="h-4 w-4" />
      </Button>
      <div className="flex flex-col gap-4">
        <h1 className="max-w-3xl text-center text-5xl font-normal tracking-tighter text-text md:text-7xl">
          <span>Bills that stay</span>
          {/* Screen readers get one stable phrase; the rotating words are visual only. */}
          <span className="sr-only"> encrypted</span>
          <span
            aria-hidden="true"
            className="relative flex w-full justify-center overflow-hidden text-center md:pb-4 md:pt-1"
          >
            &nbsp;
            {titles.map((title, index) => (
              <motion.span
                key={title}
                className="absolute font-semibold text-accent-bright"
                initial={{ opacity: 0, y: "-100" }}
                transition={{ type: "spring", stiffness: 50 }}
                animate={
                  titleNumber === index
                    ? { y: 0, opacity: 1 }
                    : { y: titleNumber > index ? -150 : 150, opacity: 0 }
                }
              >
                {title}
              </motion.span>
            ))}
          </span>
        </h1>
        <p className="max-w-2xl text-center text-lg leading-relaxed tracking-tight text-brand-tint md:text-xl">
          Opaquely turns receipts into encrypted datasets. Buyers pay for aggregate insights and never see a single
          bill.
        </p>
      </div>
      <div className="flex flex-row flex-wrap justify-center gap-3">
        <Button variant="secondary" href="/marketplace" size="lg">
          Browse marketplace
        </Button>
        <Button variant="primary" href="/upload" size="lg">
          Upload <MoveRight aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export { AnimatedHero };
