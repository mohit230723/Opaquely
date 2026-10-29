"use client";

import { usePathname } from "next/navigation";
import { StaggeredMenu } from "@/components/ui/StaggeredMenu";
import { useDataScope, useStubControls } from "@/data/provider";
import { MENU_ITEMS, SOCIAL_ITEMS } from "@/lib/nav";
import { chainModeNote } from "@/lib/network";

const STUB_NOTE = "Simulated data and transactions. Nothing is sent to a chain yet.";

/** The header menu on the right: every section at every width, and the only navigation below 768px. */
export function SiteMenu() {
  const pathname = usePathname();
  const stub = useStubControls();
  const scope = useDataScope();

  const items = MENU_ITEMS.map((item) => ({
    label: item.label,
    link: item.href,
    // Transactions is a section of My Account, never a page of its own.
    current: item.label !== "Transactions" && item.href === pathname,
  }));
  const socialItems = SOCIAL_ITEMS.map((s) => ({ label: s.label, link: s.href }));

  return (
    <StaggeredMenu
      position="right"
      isFixed
      showLogo={false}
      accentColor="#38bdf8"
      colors={["#1e3fd8", "#38bdf8"]}
      menuButtonColor="#f6f8ff"
      openMenuButtonColor="#f6f8ff"
      displaySocials
      displayItemNumbering
      items={items}
      socialItems={socialItems}
      footerNote={stub.active ? STUB_NOTE : chainModeNote(scope.chainId)}
    />
  );
}
