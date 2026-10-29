"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { Skeleton } from "@/components/Skeleton";
import { TxStatus } from "@/components/TxStatus";
import { CheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { StatusChip } from "@/components/ui/StatusChip";
import { useBuyListing, useHasAccess } from "@/data/hooks";
import type { Listing } from "@/data/types";
import { DECRYPT_COMING_LABEL, DECRYPT_HELPER } from "@/lib/copy";
import { formatEth, shortAddress } from "@/lib/format";
import { isBusy } from "@/lib/tx-machine";

/** Price, the buy confirmation, and the own-listing and access-granted states. */
export function PurchasePanel({ listing }: { listing: Listing }) {
  const router = useRouter();
  const { address } = useAccount();
  const access = useHasAccess(listing.id);
  const { state, run, reset } = useBuyListing(listing.id);
  const [open, setOpen] = useState(false);

  const own = address !== undefined && address.toLowerCase() === listing.seller.toLowerCase();
  const price = formatEth(listing.priceWei);
  const busy = isBusy(state);
  const confirmed = state.phase === "confirmed";

  function onBuy() {
    reset();
    setOpen(true);
  }

  function onConfirm() {
    if (busy) return;
    // The price the buyer saw: if it changed meanwhile, the layer rejects with a readable reason.
    void run(listing.priceWei);
  }

  function closeDialog() {
    setOpen(false);
    if (!confirmed) reset();
  }

  function viewPurchases() {
    setOpen(false);
    router.push("/buy/purchases");
  }

  let action;
  if (own) {
    action = (
      <>
        <Button disabled className="w-full">
          Buy dataset
        </Button>
        <p className="mt-3 text-sm text-muted">This is your listing. You cannot buy it.</p>
      </>
    );
  } else if (access.isPending) {
    action = <Skeleton className="h-11 w-full" />;
  } else if (access.isError) {
    action = (
      <>
        <p className="text-sm text-danger">Could not check your access.</p>
        <Button variant="secondary" className="mt-3 w-full" onClick={() => void access.refetch()}>
          Try again
        </Button>
      </>
    );
  } else if (access.data) {
    action = (
      <>
        <StatusChip variant="success">
          <CheckIcon width={14} height={14} />
          Access granted
        </StatusChip>
        <Button variant="secondary" disabled className="mt-4 w-full">
          {DECRYPT_COMING_LABEL}
        </Button>
        <p className="mt-3 text-sm text-muted">{DECRYPT_HELPER}</p>
      </>
    );
  } else {
    action = (
      <Button className="w-full" onClick={onBuy}>
        Buy dataset
      </Button>
    );
  }

  return (
    <Card>
      <p className="text-2xl font-semibold leading-tight">{price}</p>
      <p className="mt-1 text-sm text-muted">One-time payment. Permanent access.</p>
      <div className="mt-6">{action}</div>

      <ConfirmDialog
        open={open}
        title="Confirm purchase"
        confirmLabel={`Pay ${price}`}
        dismissLabel={confirmed ? "View my purchases" : "Back to listing"}
        hideConfirm={confirmed}
        busy={busy}
        onConfirm={onConfirm}
        onDismiss={confirmed ? viewPurchases : closeDialog}
        footer={<TxStatus state={state} onRetry={onConfirm} />}
      >
        {confirmed ? (
          <p>Access granted.</p>
        ) : (
          <p className="wrap-break-word">
            You are paying {price} to {shortAddress(listing.seller)} for permanent access to encrypted aggregate
            insights, not raw bills. This cannot be refunded or revoked.
          </p>
        )}
      </ConfirmDialog>
    </Card>
  );
}
