"use client";

import type { ReactNode } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { AlertIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { chainDisplayName, isWrongNetwork, supportedChainIds, wrongNetworkMessage } from "@/lib/network";

/**
 * Wrong-network gate (WALL-02). On any chain other than a supported one the banner shows and the page
 * below is inert, dimmed and unclickable, so no page action is reachable. It is not dismissible;
 * the header stays outside the gate so the user can still disconnect or switch accounts.
 * Flag off, the only supported chain is Hardhat, so there is one "Switch to Hardhat" button.
 */
export function NetworkGate({ children }: { children: ReactNode }) {
  const { chainId, isConnected } = useAccount();
  const { switchChain, isPending, isError } = useSwitchChain();
  const wrong = isWrongNetwork({ isConnected, chainId });
  const message = wrong && chainId !== undefined ? wrongNetworkMessage(chainId) : null;

  return (
    <>
      {message ? (
        <div
          role="alert"
          className="border border-danger bg-[rgba(248,113,113,0.12)] px-4 py-4 sm:px-6"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-start gap-4">
            <AlertIcon className="mt-0.5 h-6 w-6 shrink-0 text-danger" />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold">Wrong network</h2>
              <p className="mt-1 text-muted">{message.text}</p>
              {message.hint ? <p className="mt-1 text-muted">{message.hint}</p> : null}
              {isPending ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                  Check your wallet to approve the switch.
                </p>
              ) : null}
              {isError && !isPending ? (
                <p className="mt-2 text-sm text-danger">{message.switchFailed}</p>
              ) : null}
            </div>
            {supportedChainIds().map((id) => (
              <Button key={id} variant="secondary" loading={isPending} onClick={() => switchChain({ chainId: id })}>
                Switch to {chainDisplayName(id)}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
      <div
        data-testid="gated-main"
        inert={wrong}
        aria-hidden={wrong || undefined}
        className={wrong ? "flex flex-1 flex-col pointer-events-none opacity-40" : "flex flex-1 flex-col"}
      >
        {children}
      </div>
    </>
  );
}
