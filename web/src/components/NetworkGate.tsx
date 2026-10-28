"use client";

import type { ReactNode } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { AlertIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { HARDHAT_CHAIN_ID } from "@/lib/constants";
import { chainDisplayName, isWrongNetwork } from "@/lib/network";

/**
 * Wrong-network gate (WALL-02). On any chain other than Hardhat the banner shows and the page
 * below is inert, dimmed and unclickable, so no page action is reachable. It is not dismissible;
 * the header stays outside the gate so the user can still disconnect or switch accounts.
 */
export function NetworkGate({ children }: { children: ReactNode }) {
  const { chainId, isConnected } = useAccount();
  const { switchChain, isPending, isError } = useSwitchChain();
  const wrong = isWrongNetwork({ isConnected, chainId });

  return (
    <>
      {wrong && chainId !== undefined ? (
        <div
          role="alert"
          className="border border-danger bg-[rgba(248,113,113,0.12)] px-4 py-4 sm:px-6"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-start gap-4">
            <AlertIcon className="mt-0.5 h-6 w-6 shrink-0 text-danger" />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold">Wrong network</h2>
              <p className="mt-1 text-muted">
                Opaquely runs on the Hardhat local chain (chain {HARDHAT_CHAIN_ID}). Your wallet is on{" "}
                {chainDisplayName(chainId)}.
              </p>
              {isPending ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                  Check your wallet to approve the switch.
                </p>
              ) : null}
              {isError && !isPending ? (
                <p className="mt-2 text-sm text-danger">
                  Could not switch network. Open your wallet and select Hardhat (chain {HARDHAT_CHAIN_ID}).
                </p>
              ) : null}
            </div>
            <Button variant="secondary" loading={isPending} onClick={() => switchChain({ chainId: HARDHAT_CHAIN_ID })}>
              Switch to Hardhat
            </Button>
          </div>
        </div>
      ) : null}
      <div
        data-testid="gated-main"
        inert={wrong}
        aria-hidden={wrong || undefined}
        className={wrong ? "pointer-events-none opacity-40" : undefined}
      >
        {children}
      </div>
    </>
  );
}
