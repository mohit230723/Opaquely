import { Suspense } from "react";
import { GuardLoading } from "@/components/WalletGate";
import { UploadFlow } from "@/components/upload/UploadFlow";

// Suspense is required once UploadFlow reads useSearchParams (resume a draft, plan 07-07): without it a static
// build fails with "Missing Suspense boundary with useSearchParams".
export default function UploadPage() {
  return (
    <Suspense fallback={<GuardLoading />}>
      <UploadFlow />
    </Suspense>
  );
}
