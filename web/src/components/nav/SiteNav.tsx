"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, activeIndex } from "@/lib/nav";

/** The Primary nav: Upload, Marketplace, My Datasets, My Account. Client-side links only. */
export function SiteNav() {
  const current = activeIndex(usePathname());

  return (
    <nav
      aria-label="Primary"
      className="order-last -mx-4 w-[calc(100%+2rem)] overflow-x-auto border-t border-border px-4 sm:-mx-6 sm:w-[calc(100%+3rem)] sm:px-6 md:order-none md:mx-0 md:flex md:w-auto md:flex-1 md:justify-center md:border-t-0 md:px-0"
    >
      <ul className="flex gap-1">
        {NAV.map((item, i) => {
          const active = i === current;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-sm font-semibold ${
                  active ? "border-accent-bright text-[#f6f8ff]" : "border-transparent text-muted hover:text-text"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
