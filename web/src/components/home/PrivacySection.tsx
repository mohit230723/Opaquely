import { SectionHeading } from "./SectionHeading";
import { Card } from "@/components/ui/Card";

const ITEMS = [
  { title: "Bill images", line: "Your photo is read in this tab and never uploaded anywhere." },
  { title: "Vendor names", line: "Who you paid stays on your device. It is never sent to the chain." },
  { title: "Plain amounts and dates", line: "Amounts and dates are encrypted first. Only ciphertext goes on-chain." },
];

/** Home: what stays in the seller's browser. Three glow cards in a `ul` (the How it works `ol` stays the only list of steps). */
export function PrivacySection() {
  return (
    <section>
      <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
        <SectionHeading index="02" eyebrow="Privacy by design" title="What never leaves your browser" lede="Reading the bill happens on your device. The chain only ever sees ciphertext." />
        <ul className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {ITEMS.map((item) => (
            <Card as="li" glow key={item.title} className="list-none">
              {/* One content child: the GlowCard grid has a content row and an optional footer row. */}
              <div>
                <h3 className="text-base font-semibold text-text">{item.title}</h3>
                <p className="mt-2 text-sm text-muted">{item.line}</p>
              </div>
            </Card>
          ))}
        </ul>
      </div>
    </section>
  );
}
