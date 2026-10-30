import { Card } from "@/components/ui/Card";

const ITEMS = [
  { title: "Bill images", line: "Photos stay in this tab. They are never uploaded." },
  { title: "Vendor names", line: "Stay on this device. Never sent to the chain." },
  { title: "Plain amounts and dates", line: "Only encrypted values reach the chain." },
];

/** Home: what stays in the seller's browser. Three glow cards in a `ul` (the How it works `ol` stays the only list of steps). */
export function PrivacySection() {
  return (
    <section className="bg-bg">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold text-text">What never leaves your browser</h2>
        <ul className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
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
