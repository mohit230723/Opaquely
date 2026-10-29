"use client";

import { useDataScope, useStubControls } from "@/data/provider";
import { chainModeNote } from "@/lib/network";

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

/**
 * Honest label for the data layer. Stub mode says nothing is sent to a chain and offers the demo toggles that
 * force a failure or an empty wallet. Chain mode says what the connected chain is: a local mock that is not
 * real FHE, or Sepolia with real FHE.
 */
export function AppFooter() {
  const stub = useStubControls();
  const scope = useDataScope();

  return (
    <footer className="border-t border-border bg-surface px-4 py-6 text-sm text-muted sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2">
        {stub.active ? (
          <>
            <p>Simulated data and transactions. Nothing is sent to a chain yet.</p>
            <div className="flex flex-wrap items-center gap-x-6">
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
    </footer>
  );
}
