"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { NetworkBadge } from "@/components/NetworkBadge";
import { RoleSwitcher } from "@/components/RoleSwitcher";
import { useRole, type Role } from "@/lib/role";

interface NavItem {
  href: string;
  label: string;
  isActive: (path: string) => boolean;
}

const underPrefix = (prefix: string) => (p: string) => p === prefix || p.startsWith(prefix + "/");

const NAV: Record<Role, NavItem[]> = {
  seller: [
    { href: "/sell", label: "Dashboard", isActive: (p) => p === "/sell" },
    { href: "/sell/datasets", label: "Datasets", isActive: underPrefix("/sell/datasets") },
    { href: "/activity", label: "Activity", isActive: underPrefix("/activity") },
  ],
  buyer: [
    {
      href: "/buy",
      label: "Datasets for sale",
      isActive: (p) => (p === "/buy" || p.startsWith("/buy/")) && !underPrefix("/buy/purchases")(p),
    },
    { href: "/buy/purchases", label: "My purchases", isActive: underPrefix("/buy/purchases") },
    { href: "/activity", label: "Activity", isActive: underPrefix("/activity") },
  ],
};

export function AppHeader() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const role = useRole(address);
  const hasRole = isConnected && Boolean(role);
  const showArea = hasRole && pathname !== "/" && pathname !== "/role";

  return (
    <header className="sticky top-0 z-40 flex min-h-16 flex-wrap items-center gap-x-4 border-b border-border bg-surface px-4 sm:px-6 md:flex-nowrap">
      <Link href="/" className="flex h-16 items-center text-base font-semibold text-text">
        Opaquely
      </Link>
      {showArea && role ? (
        <nav
          aria-label={role === "seller" ? "Seller" : "Buyer"}
          className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto border-t border-border px-4 sm:-mx-6 sm:w-[calc(100%+3rem)] sm:px-6 md:order-none md:mx-0 md:w-auto md:flex-1 md:border-t-0 md:px-0"
        >
          {NAV[role].map((item) => {
            const active = item.isActive(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-sm font-semibold ${
                  active ? "border-accent-bright text-text" : "border-transparent text-muted hover:text-text"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
      <div className="ml-auto flex min-h-16 min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-2 py-2">
        <NetworkBadge />
        {/* /role is itself the role chooser, so the header control would only duplicate it there. */}
        {hasRole && pathname !== "/role" && role && address ? <RoleSwitcher address={address} role={role} /> : null}
        <ConnectButton showBalance={false} accountStatus={{ smallScreen: "avatar", largeScreen: "address" }} />
      </div>
    </header>
  );
}
