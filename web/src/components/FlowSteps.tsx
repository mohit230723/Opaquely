import { Card } from "@/components/ui/Card";

const STEPS = [
  { title: "Upload", line: "Add a bill photo. It stays in your browser." },
  { title: "OCR", line: "Text is read on your device. Nothing goes to a server." },
  { title: "Encrypt", line: "Amount, category and date are encrypted before they leave." },
  { title: "Compute", line: "The contract adds up encrypted totals without decrypting." },
  { title: "List", line: "Seal the dataset and set a price in test ETH." },
  { title: "Buy", line: "Buyers pay once and get access to the aggregates only." },
];

export function FlowSteps() {
  return (
    <section className="bg-bg">
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
