import type { ReactNode } from "react";
import { RoleGuard } from "@/components/RoleGuard";

// The one place the seller guard is mounted: every /sell page is wrapped once.
export default function SellerLayout({ children }: { children: ReactNode }) {
  return <RoleGuard need="seller">{children}</RoleGuard>;
}
