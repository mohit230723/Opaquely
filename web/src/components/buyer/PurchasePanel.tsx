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
import { BUYER_CAN_DECRYPT, DECRYPT_COMING_LABEL, DECRYPT_HELPER } from "@/lib/copy";
import { formatEth, shortAddress } from "@/lib/format";
import { isBusy } from "@/lib/tx-machine";

/** Identity of one panel: a wallet looking at one listing. */
export function panelKey(address: string | undefined, listingId: string): string {
  return `${address ?? "none"}:${listingId}`;
}

/**
 * Price, the buy confirmation, and the own-listing and access-granted states. The inner panel is keyed by
 * wallet and listing, so switching account remounts it: an open dialog, a "Transaction confirmed" or a
 * failure from the previous wallet cannot carry over, and "Pay" can never send from a wallet other than
 * the one that opened the dialog.
 */
export function PurchasePanel({ listing }: { listing: Listing }) {
  const { address } = useAccount();
  return <PurchasePanelInner key={panelKey(address, listing.id)} listing={listing} />;
}

function PurchasePanelInner({ listing }: { listing: Listing }) {
  const router = useRouter();
  const { address } = useAccount();
  const access = useHasAccess(listing.id);
  const { state, run, reset } = useBuyListing(listing.id);
  const [open, setOpen] = useState(false);

  const own = address !== undefined && address.toLowerCase() === listing.seller.toLowerCase();
  const price = formatEth(listing.priceWei);
  const busy = isBusy(state);
  const confirmed = state.phase === "confirmed";
  // A buy that failed (typically AlreadyPurchased from a stale tab) while the chain now says access is
  // granted can only fail the same way again, so the dialog stops offering Pay and Try again. The reason
  // stays readable and "Back to listing" closes it.
  const failedButOwned = state.phase === "failed" && access.data === true;

  function onBuy() {
    reset();
    setOpen(true);
  }

  function onConfirm() {
    if (busy) return;
    // The price the buyer saw: if it changed meanwhile, the layer rejects with a readable reason.
    // After the attempt settles, access is re-read from the chain: a stale tab whose buy failed with
    // AlreadyPurchased shows "Access granted" at once instead of after the next poll. On success
    // useBuyListing has already invalidated hasAccess, so the extra read is harmless. Access is only ever
    // read from hasAccess, never set from the tx result.
    void run(listing.priceWei).then(() => access.refetch());
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
  } else if (access.isError && access.data === undefined) {
    // Only a first-load failure replaces the action. A failed background poll keeps the last known access
    // (the query keeps its data), so a buyer in the middle of a purchase never loses the Buy or Access card.
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
        <p className="mt-3 text-sm">{BUYER_CAN_DECRYPT}</p>
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
        hideConfirm={confirmed || failedButOwned}
        busy={busy}
        onConfirm={onConfirm}
        onDismiss={confirmed ? viewPurchases : closeDialog}
        footer={<TxStatus state={state} onRetry={failedButOwned ? undefined : onConfirm} />}
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
