import { Card } from "@/components/ui/Card";

const STEPS = [
  { title: "Read", line: "Upload a bill photo. The text is read on your device, never on a server." },
  { title: "Encrypt", line: "Amount, category and date are encrypted before they leave your browser." },
  { title: "Compute", line: "The contract adds up encrypted totals without ever decrypting them." },
  { title: "List", line: "Set a price in test ETH and list the sealed dataset on the Marketplace." },
  { title: "Buy", line: "A buyer pays once. The payment is held until you withdraw it." },
  { title: "Access", line: "The contract grants the buyer's wallet access to the totals, not to bills." },
];

// The only `ol` on Home: six glow cards, 6 columns from 1024px, 3 from 768px, 1 below.
export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-bg">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold text-text">How it works</h2>
        <ol className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {STEPS.map((step, i) => (
            <Card as="li" glow key={step.title} className="list-none">
              {/* One content child: the GlowCard grid has a content row and an optional footer row. */}
              <div>
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-accent-bright text-sm font-semibold text-accent-bright"
                >
                  {i + 1}
                </span>
                <h3 className="mt-4 text-base font-semibold text-text">{step.title}</h3>
                <p className="mt-2 text-sm text-muted">{step.line}</p>
              </div>
            </Card>
          ))}
        </ol>
      </div>
    </section>
  );
}
