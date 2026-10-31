"use client";

import Image from "next/image";
import Link from "next/link";
import { useDataScope, useStubControls } from "@/data/provider";
import { BRAND, WORDMARK_RATIO } from "@/lib/brand";
import { NAV, SOCIAL_ITEMS } from "@/lib/nav";
import { chainModeNote } from "@/lib/network";

const WORDMARK_HEIGHT = 28;

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-accent"
      />
      {label}
    </label>
  );
}

const linkClass =
  "inline-flex min-h-11 items-center text-sm text-muted transition-colors duration-150 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-bright";

/**
 * The app's one footer, in normal document flow (never fixed): brand, the Explore and Project link columns, and a
 * bottom bar with the honest data-layer label and the copyright. Stub mode says nothing is sent to a chain and
 * offers the demo toggles that force a failure or an empty wallet. Chain mode says what the connected chain is: a
 * local mock that is not real FHE, or Sepolia with real FHE (chainModeNote, verbatim; the rehearsal reads it).
 */
export function AppFooter() {
  const stub = useStubControls();
  const scope = useDataScope();

  return (
    <footer className="border-t border-white/10 bg-[#050816]/60 px-4 backdrop-blur-xl pb-6 pt-12 text-sm text-muted sm:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand block: the wordmark is a plain image, not a link (only the header logo links home). */}
          <div className="lg:col-span-2">
            <Image
              src={BRAND.wordmark}
              alt="Opaquely"
              unoptimized
              width={Math.round(WORDMARK_HEIGHT * WORDMARK_RATIO)}
              height={WORDMARK_HEIGHT}
              className="h-7 w-auto"
            />
            <p className="mt-4 max-w-sm">Encrypted bill datasets. Buyers get insights, never single bills.</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-text">Explore</p>
            <nav aria-label="Footer" className="mt-2">
              <ul>
                {NAV.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className={linkClass}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div>
            <p className="text-sm font-semibold text-text">Project</p>
            <ul className="mt-2">
              {SOCIAL_ITEMS.map((item) => (
                <li key={item.href}>
                  <a href={item.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    {item.label}
                  </a>
                </li>
              ))}
              <li className="flex min-h-11 items-center">Built on Zama FHEVM</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {stub.active ? (
              <>
                <p>Simulated data and transactions. Nothing is sent to a chain yet.</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-6">
                  <Toggle label="Fail the next transaction (demo)" checked={stub.failNext} onChange={stub.setFailNext} />
                  <Toggle label="Fail the next read (demo)" checked={stub.failNextRead} onChange={stub.setFailNextRead} />
                  <Toggle
                    label="Start from an empty wallet (demo)"
                    checked={stub.seedMode === "empty"}
                    onChange={(v) => stub.setSeedMode(v ? "empty" : "demo")}
                  />
                </div>
              </>
            ) : (
              <p>{chainModeNote(scope.chainId)}</p>
            )}
          </div>
          <p className="shrink-0">© 2026 Opaquely. A college minor project.</p>
        </div>
      </div>
    </footer>
  );
}
