"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { GuardLoading } from "@/components/RoleGuard";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { shortAddress } from "@/lib/format";
import { setRole, useRole, type Role } from "@/lib/role";
import { useWalletReady } from "@/lib/wallet-ready";

const OPTIONS: { role: Role; title: string; description: string; label: string; href: string }[] = [
  {
    role: "seller",
    title: "Seller",
    description: "Upload bills, encrypt them, and list datasets for sale.",
    label: "Continue as Seller",
    href: "/sell",
  },
  {
    role: "buyer",
    title: "Buyer",
    description: "Browse encrypted datasets and buy access to aggregate insights.",
    label: "Continue as Buyer",
    href: "/buy",
  },
];

export default function RolePage() {
  const router = useRouter();
  const { status, address } = useAccount();
  const current = useRole(address);
  const walletReady = useWalletReady();
  // The card the user has moved to. null means "follow the stored role until they pick".
  const [picked, setPicked] = useState<Role | null>(null);
  const radios = useRef<Partial<Record<Role, HTMLDivElement | null>>>({});

  if (!walletReady || status === "connecting" || status === "reconnecting" || current === undefined) {
    return <GuardLoading />;
  }

  if (status === "disconnected" || !address) {
    return (
      <PageShell title="Connect your wallet to continue">
        <div className="flex flex-col items-start gap-6">
          <p className="text-muted">Your role is saved per wallet address.</p>
          <ConnectButton />
        </div>
      </PageShell>
    );
  }

  const selected: Role | null = picked ?? current;

  function choose(option: (typeof OPTIONS)[number]) {
    if (!address) return;
    setRole(address, option.role);
    router.push(option.href);
  }

  function select(index: number) {
    const next = OPTIONS[(index + OPTIONS.length) % OPTIONS.length];
    setPicked(next.role);
    radios.current[next.role]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>, index: number) {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      select(index + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      select(index - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setPicked(OPTIONS[index].role);
    }
  }

  return (
    <PageShell title="Choose your role" subtitle="Sellers upload and encrypt bills. Buyers purchase access to insights.">
      <div role="radiogroup" aria-label="Role" className="grid gap-6 md:grid-cols-2">
        {OPTIONS.map((option, index) => {
          const isSelected = selected === option.role;
          // Roving tabindex: the selected card is the one tab stop; with none selected, the first card.
          const tabStop = selected === null ? index === 0 : isSelected;
          return (
            <Card
              key={option.role}
              className="flex flex-col gap-4"
              style={isSelected ? { borderColor: "var(--color-accent)", borderWidth: 2 } : undefined}
            >
              <div
                role="radio"
                aria-checked={isSelected}
                tabIndex={tabStop ? 0 : -1}
                ref={(el) => {
                  radios.current[option.role] = el;
                }}
                onClick={() => setPicked(option.role)}
                onKeyDown={(e) => onKeyDown(e, index)}
                className="flex cursor-pointer flex-col gap-2 rounded-lg outline-offset-4 focus-visible:outline-2 focus-visible:outline-accent-bright"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold leading-tight">{option.title}</h2>
                  {current === option.role ? <StatusChip variant="info">Current role</StatusChip> : null}
                </div>
                <p className="text-base">{option.description}</p>
              </div>
              <div className="mt-auto">
                <Button variant={isSelected ? "primary" : "secondary"} onClick={() => choose(option)}>
                  {option.label}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
      <p className="mt-6 text-sm text-muted">
        You can switch roles any time from the header. Your choice is saved for {shortAddress(address)} in this browser.
      </p>
    </PageShell>
  );
}
