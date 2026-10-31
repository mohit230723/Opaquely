import { SectionHeading } from "./SectionHeading";
import { Card } from "@/components/ui/Card";

const ITEMS = [
  { title: "Zama FHEVM", line: "Smart contracts add and compare encrypted values without decrypting them." },
  { title: "Hardhat", line: "Runs the local test chain and deploys the contracts." },
  { title: "Next.js", line: "The app you are using, with OCR running right in the page." },
];

/** Home: the stack behind the demo. Three glow cards in a `ul`. */
export function TechSection() {
  return (
    <section>
      <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
        <SectionHeading index="03" eyebrow="Under the hood" title="Built with" lede="Fully homomorphic encryption on an EVM chain, behind a plain web app." />
        <ul className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
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
