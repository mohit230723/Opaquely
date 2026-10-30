import { Button } from "@/components/ui/Button";

/** Home: the closing call to action on a flat surface band, before the footer. Both CTAs are plain links. */
export function ClosingCta() {
  return (
    <section aria-labelledby="closing-cta-title" className="bg-bg">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-border bg-surface px-6 py-12 text-center">
          <h2 id="closing-cta-title" className="text-2xl font-semibold text-text">
            Try it with test ETH
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted">
            Connect a wallet, upload three sample bills and list your first dataset.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button href="/upload" size="lg">
              Upload
            </Button>
            <Button href="/marketplace" variant="secondary" size="lg">
              Browse marketplace
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
