import type { ReactNode } from "react";
import { RoleGuard } from "@/components/RoleGuard";

// Shared by both roles: any connected wallet with a chosen role may read the activity timeline.
export default function ActivityLayout({ children }: { children: ReactNode }) {
  return <RoleGuard need="any">{children}</RoleGuard>;
}
