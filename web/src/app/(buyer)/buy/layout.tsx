import type { ReactNode } from "react";
import { RoleGuard } from "@/components/RoleGuard";

// The one place the buyer guard is mounted: every /buy page is wrapped once.
export default function BuyerLayout({ children }: { children: ReactNode }) {
  return <RoleGuard need="buyer">{children}</RoleGuard>;
}
