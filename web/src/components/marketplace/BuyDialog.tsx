"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { TxStatus } from "@/components/TxStatus";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useBuyListing } from "@/data/hooks";
import type { Listing } from "@/data/types";
import { formatEth, shortAddress } from "@/lib/format";
import { isBusy } from "@/lib/tx-machine";

/** Identity of one purchase surface: a wallet looking at one listing. Key the dialog's owner with it. */
export function panelKey(address: string | undefined, listingId: string): string {
  return `${address ?? "none"}:${listingId}`;
}

export interface BuyDialogProps {
  listing: Listing;
  open: boolean;
  /** Whether the chain says this wallet already has access. undefined while unknown. */
  owned: boolean | undefined;
  /** Closes the dialog (the parent owns `open`). */
  onClose: () => void;
  /** Called after every buy attempt settles, so the parent re-reads access from the chain. */
  onSettled: () => void;
}

/**
 * The purchase confirmation and its transaction, shared by the marketplace card and the detail page.
 * The parent keys it (or its own panel) by wallet and listing with `panelKey`, so switching account remounts
 * it: an open dialog, a "Transaction confirmed" or a failure from the previous wallet cannot carry over, and
 * "Pay" can never send from a wallet other than the one that opened the dialog.
 */
export function BuyDialog({ listing, open, owned, onClose, onSettled }: BuyDialogProps) {
  const router = useRouter();
  const { state, run, reset } = useBuyListing(listing.id);

  const price = formatEth(listing.priceWei);
  const busy = isBusy(state);
  const confirmed = state.phase === "confirmed";
  // A buy that failed (typically AlreadyPurchased from a stale tab) while the chain now says access is
  // granted can only fail the same way again, so the dialog stops offering Pay and Try again. The reason
  // stays readable and "Back to listing" closes it.
  const failedButOwned = state.phase === "failed" && owned === true;

  // Every press of Buy starts from a clean transaction state (a failure from an earlier attempt that was
  // closed is not shown again).
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current) reset();
    wasOpen.current = open;
  }, [open, reset]);

  function onConfirm() {
    if (busy) return;
    // The price the buyer saw: if it changed meanwhile, the layer rejects with a readable reason.
    // After the attempt settles, access is re-read from the chain: a stale tab whose buy failed with
    // AlreadyPurchased shows "Access granted" at once instead of after the next poll. On success
    // useBuyListing has already invalidated the access reads, so the extra read is harmless. Access is only
    // ever read from the chain, never set from the tx result.
    void run(listing.priceWei).then(() => onSettled());
  }

  function closeDialog() {
    onClose();
    if (!confirmed) reset();
  }

  function viewPurchases() {
    onClose();
    router.push("/my-datasets");
  }

  return (
    <ConfirmDialog
      open={open}
      title="Confirm purchase"
      confirmLabel={`Pay ${price}`}
      dismissLabel={confirmed ? "View my datasets" : "Back to listing"}
      hideConfirm={confirmed || failedButOwned}
      busy={busy}
      onConfirm={onConfirm}
      onDismiss={confirmed ? viewPurchases : closeDialog}
      // Esc only closes, even once confirmed: the card or panel behind it then shows Access granted.
      onEscape={closeDialog}
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
  );
}
