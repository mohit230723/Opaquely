import { Card } from "@/components/ui/Card";

const ITEMS = [
  { title: "Zama FHEVM", line: "Computes on encrypted data on-chain." },
  { title: "Hardhat", line: "The local test chain and the contracts." },
  { title: "Next.js", line: "The web app you are using." },
];

/** Home: the stack behind the demo. Three glow cards in a `ul`. */
export function TechSection() {
  return (
    <section className="bg-bg">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold text-text">Built with</h2>
        <ul className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {ITEMS.map((item) => (
            <Card as="li" glow key={item.title} className="list-none">
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
