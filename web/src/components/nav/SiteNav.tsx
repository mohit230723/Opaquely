"use client";

import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import GooeyNav from "@/components/ui/GooeyNav";
import { NAV, activeIndex } from "@/lib/nav";

// GooeyNav parses hex and rgba() only, so every color here is one of those.
const NAV_STYLE = {
  "--gn-ink": "#f6f8ff",
  "--gn-muted": "#c3d0ee",
  "--gn-font": "16px",
  "--gn-x": "20px",
};

// The frame GooeyNav would draw, drawn here instead so the wallet button sits inside the same pill.
const FRAME_STYLE = {
  background: "rgba(11,18,48,0.7)",
  boxShadow: "inset 0 0 0 1px rgba(165,216,255,0.14), inset 0 1px 0 rgba(165,216,255,0.10)",
};

const WALLET_CLASS =
  "inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full px-5 text-base font-semibold text-text transition-colors hover:bg-white/10";

/** The wallet as one more item in the nav pill: Connect wallet, Wrong network, or the short address. */
function NavWallet() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openAccountModal, openChainModal, openConnectModal }) => {
        if (!mounted) return <span className={WALLET_CLASS} aria-hidden="true" style={{ visibility: "hidden" }}>Connect wallet</span>;
        if (!account || !chain) {
          return (
            <button type="button" onClick={openConnectModal} className={`${WALLET_CLASS} bg-accent hover:bg-accent-hover`}>
              Connect wallet
            </button>
          );
        }
        if (chain.unsupported) {
          return (
            <button type="button" onClick={openChainModal} className={`${WALLET_CLASS} text-danger`}>
              Wrong network
            </button>
          );
        }
        return (
          <button type="button" onClick={openAccountModal} className={WALLET_CLASS}>
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-success" />
            {account.displayName}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}

/** The Primary nav from 768px: the vendored GooeyNav plus the wallet, centered, active item from the pathname. */
export function SiteNav() {
  const current = activeIndex(usePathname());

  return (
    <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 md:flex">
      <div className="flex items-center gap-1 rounded-full p-1.5" style={FRAME_STYLE}>
        <GooeyNav
          items={[...NAV]}
          activeIndex={current}
          aria-label="Primary"
          theme="dark"
          size="md"
          frame={false}
          particleCount={15}
          spread={56}
          animationTime={600}
          timeVariance={300}
          gooeyness={0.5}
          wobble={0.5}
          hoverEffect
          color="#1e3fd8"
          activeTextColor="#f6f8ff"
          colors={["#1e3fd8", "#38bdf8"]}
          style={NAV_STYLE}
        />
        <NavWallet />
      </div>
    </div>
  );
}
