"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Skeleton } from "@/components/Skeleton";
import { CheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { BuyDialog, panelKey } from "@/components/marketplace/BuyDialog";
import { useHasAccess } from "@/data/hooks";
import type { Listing } from "@/data/types";
import { BUYER_CAN_DECRYPT, DECRYPT_COMING_LABEL, DECRYPT_HELPER } from "@/lib/copy";
import { formatEth } from "@/lib/format";

// The panel identity lives with the shared dialog; re-exported for the detail page and its tests.
export { panelKey };

/**
 * Price, the buy action (the shared BuyDialog), and the own-listing and access-granted states. The inner panel is keyed by
 * wallet and listing, so switching account remounts it: an open dialog, a "Transaction confirmed" or a
 * failure from the previous wallet cannot carry over, and "Pay" can never send from a wallet other than
 * the one that opened the dialog.
 */
export function PurchasePanel({ listing }: { listing: Listing }) {
  const { address } = useAccount();
  return <PurchasePanelInner key={panelKey(address, listing.id)} listing={listing} />;
}

function PurchasePanelInner({ listing }: { listing: Listing }) {
  const { address } = useAccount();
  const access = useHasAccess(listing.id);
  const [open, setOpen] = useState(false);

  const own = address !== undefined && address.toLowerCase() === listing.seller.toLowerCase();
  const price = formatEth(listing.priceWei);

  let action;
  if (own) {
    action = (
      <>
        <Button disabled className="w-full">
          Buy this dataset
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
      <Button className="w-full" onClick={() => setOpen(true)}>
        Buy this dataset
      </Button>
    );
  }

  return (
    <Card>
      <p className="text-2xl font-semibold leading-tight">{price}</p>
      <p className="mt-1 text-sm text-muted">One-time payment. Permanent access.</p>
      <div className="mt-6">{action}</div>

      <BuyDialog
        listing={listing}
        open={open}
        owned={access.data}
        onClose={() => setOpen(false)}
        onSettled={() => void access.refetch()}
      />
    </Card>
  );
}
