"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { setRole, setRoleSwitching, type Role } from "@/lib/role";

const OPTIONS: { role: Role; label: string; href: string }[] = [
  { role: "seller", label: "Seller", href: "/sell" },
  { role: "buyer", label: "Buyer", href: "/buy" },
];

/** Two-option segmented control. Choosing the other role stores it for the address and opens that area. */
export function RoleSwitcher({ address, role }: { address: string; role: Role }) {
  const router = useRouter();
  const pathname = usePathname();
  const switchedFrom = useRef<string | null>(null);
  const refs = useRef<Partial<Record<Role, HTMLButtonElement | null>>>({});

  // The navigation has landed: let guards act again. The timer covers a navigation that never lands.
  useEffect(() => {
    if (switchedFrom.current !== null && pathname !== switchedFrom.current) {
      switchedFrom.current = null;
      setRoleSwitching(false);
    }
  }, [pathname]);

  function choose(next: (typeof OPTIONS)[number]) {
    if (next.role === role) return;
    switchedFrom.current = pathname;
    setRoleSwitching(true);
    window.setTimeout(() => setRoleSwitching(false), 3000);
    setRole(address, next.role);
    router.push(next.href);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    let target: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") target = (index + 1) % OPTIONS.length;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") target = (index - 1 + OPTIONS.length) % OPTIONS.length;
    if (target === null) return;
    e.preventDefault();
    refs.current[OPTIONS[target].role]?.focus();
    choose(OPTIONS[target]);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Role"
      className="inline-flex h-11 overflow-hidden rounded-lg border border-border-strong"
    >
      {OPTIONS.map((o, i) => {
        const selected = o.role === role;
        return (
          <button
            key={o.role}
            ref={(el) => {
              refs.current[o.role] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => choose(o)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`min-w-11 px-3 text-sm font-semibold transition-colors duration-150 ${
              selected ? "bg-accent text-text" : "bg-transparent text-muted hover:bg-surface-raised hover:text-text"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
