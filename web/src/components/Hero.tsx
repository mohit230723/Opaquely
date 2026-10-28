"use client";

import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton, useConnectModal } from "@rainbow-me/rainbowkit";
import { GeistMono } from "geist/font/mono";
import GradientASCII from "./GradientASCII";
import { Button } from "@/components/ui/Button";
import { useRole } from "@/lib/role";

// The hero top is near-white and the bottom near-black, so the copy sits in the lower half over a scrim.
const FALLBACK_BACKGROUND = "linear-gradient(to bottom, #1e3fd8, #050816)";
const SCRIM_BACKGROUND = "linear-gradient(to top, #050816 0%, rgba(5,8,22,0.85) 45%, rgba(5,8,22,0) 100%)";

export function Hero() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const role = useRole(address);

  // Disconnected: the wallet is the entry to every flow. Connected: skip /role when the stored role matches.
  function go(wanted: "seller" | "buyer") {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    if (role === wanted) {
      router.push(wanted === "seller" ? "/sell" : "/buy");
      return;
    }
    router.push("/role");
  }

  return (
    <section className="relative h-[600px] w-full overflow-hidden" style={{ background: FALLBACK_BACKGROUND }}>
      <GradientASCII
        colors={["#1e3fd8", "#f6f8ff", "#a5d8ff", "#38bdf8"]}
        shape="horizon"
        characters=" =+xX0S8#@"
        cellSize={18}
        density={0.8}
        fontFamily={GeistMono.style.fontFamily}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[360px]"
        style={{ background: SCRIM_BACKGROUND }}
      />
      <div className="absolute inset-x-0 bottom-0">
        <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6">
          <h1 className="text-[40px] font-semibold leading-[1.1] text-text">
            Your bills, encrypted. Insights, for sale.
          </h1>
          <p className="mt-4 max-w-[560px] text-base text-brand-tint">
            Opaquely turns receipts into encrypted datasets. Buyers pay for aggregate insights and never see a single
            bill.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Button variant="primary" onClick={() => go("seller")}>
              Start selling
            </Button>
            <Button variant="secondary" onClick={() => go("buyer")}>
              Browse datasets
            </Button>
            {isConnected ? null : <ConnectButton showBalance={false} />}
          </div>
        </div>
      </div>
    </section>
  );
}
