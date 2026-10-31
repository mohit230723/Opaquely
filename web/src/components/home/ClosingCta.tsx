import { Button } from "@/components/ui/Button";

/** Home: the closing call to action on a flat surface band, before the footer. Both CTAs are plain links. */
export function ClosingCta() {
  return (
    <section aria-labelledby="closing-cta-title">
      <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-[#1e3fd8]/30 via-[#0b1230]/60 to-[#38bdf8]/10 px-6 py-16 text-center shadow-[0_20px_80px_-20px_rgba(30,63,216,0.6)] backdrop-blur-xl">
          <h2 id="closing-cta-title" className="text-3xl font-semibold tracking-tight text-text md:text-5xl">
            Sell what your bills say, not what they show
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-brand-tint">
            Connect a wallet, encrypt three sample bills and list your first dataset in a couple of minutes. Test ETH only.
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
