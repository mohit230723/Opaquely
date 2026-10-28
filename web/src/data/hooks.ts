"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTx, type UseTx } from "@/lib/use-tx";
import { recordSessionBill } from "@/lib/session-bills";
import { useDataLayer, useDataScope } from "./provider";
import { queryKeys } from "./keys";
import type { BillDraft } from "./types";

/** What every write hook returns: { state, run(input), reset() } from useTx. */
export type TxController<I> = UseTx<I>;

// ---- reads: enabled only when a wallet is connected, so every key stays per wallet ----

export function useMyDatasets() {
  const layer = useDataLayer();
  const scope = useDataScope();
  return useQuery({
    queryKey: queryKeys.myDatasets(scope),
    queryFn: () => layer.listMyDatasets(),
    enabled: Boolean(scope.address),
  });
}

export function useDataset(id: string) {
  const layer = useDataLayer();
  const scope = useDataScope();
  return useQuery({
    queryKey: queryKeys.dataset(scope, id),
    queryFn: () => layer.getDataset(id),
    enabled: Boolean(scope.address),
  });
}

export function useSellerStats() {
  const layer = useDataLayer();
  const scope = useDataScope();
  return useQuery({
    queryKey: queryKeys.sellerStats(scope),
    queryFn: () => layer.getSellerStats(),
    enabled: Boolean(scope.address),
  });
}

export function useListings() {
  const layer = useDataLayer();
  const scope = useDataScope();
  return useQuery({
    queryKey: queryKeys.listings(scope),
    queryFn: () => layer.listListings(),
    enabled: Boolean(scope.address),
  });
}

export function useListing(id: string) {
  const layer = useDataLayer();
  const scope = useDataScope();
  return useQuery({
    queryKey: queryKeys.listing(scope, id),
    queryFn: () => layer.getListing(id),
    enabled: Boolean(scope.address),
  });
}

export function useHasAccess(listingId: string) {
  const layer = useDataLayer();
  const scope = useDataScope();
  return useQuery({
    queryKey: queryKeys.hasAccess(scope, listingId),
    queryFn: () => layer.hasAccess(listingId),
    enabled: Boolean(scope.address),
  });
}

export function useMyPurchases() {
  const layer = useDataLayer();
  const scope = useDataScope();
  return useQuery({
    queryKey: queryKeys.myPurchases(scope),
    queryFn: () => layer.listMyPurchases(),
    enabled: Boolean(scope.address),
  });
}

export function useActivity() {
  const layer = useDataLayer();
  const scope = useDataScope();
  return useQuery({
    queryKey: queryKeys.activity(scope),
    queryFn: () => layer.listActivity(),
    enabled: Boolean(scope.address),
  });
}

export function useChainView(datasetId: string) {
  const layer = useDataLayer();
  const scope = useDataScope();
  return useQuery({
    queryKey: queryKeys.chainView(scope, datasetId),
    queryFn: () => layer.getChainView(datasetId),
    enabled: Boolean(scope.address),
  });
}

// ---- writes: useTx over a DataLayer method, refreshing exactly the queries the write touches ----

/** Create a dataset, refreshing the seller queries once confirmed. */
export function useCreateDataset() {
  const layer = useDataLayer();
  const scope = useDataScope();
  const queryClient = useQueryClient();
  return useTx((input: { name: string }) => layer.createDataset(input), {
    onConfirmed: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.myDatasets(scope) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sellerStats(scope) }),
      ]);
    },
  });
}

/**
 * Add one bill. Only amountCents, dateDays and category reach the DataLayer; the full draft, vendor
 * included, goes to the tab-memory session map so the chain-vs-you panel can show it.
 */
export function useAddBill(datasetId: string): TxController<{ draft: BillDraft; index: number }> {
  const layer = useDataLayer();
  const scope = useDataScope();
  const queryClient = useQueryClient();
  return useTx(
    ({ draft }: { draft: BillDraft; index: number }) =>
      layer.addBill(datasetId, {
        amountCents: draft.amountCents,
        dateDays: draft.dateDays,
        category: draft.category,
      }),
    {
      onConfirmed: async (_receipt, { draft, index }) => {
        if (scope.address) recordSessionBill(scope.address, datasetId, { index, draft });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.dataset(scope, datasetId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.myDatasets(scope) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.chainView(scope, datasetId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.sellerStats(scope) }),
        ]);
      },
    },
  );
}

export function useListDataset(
  datasetId: string,
): TxController<{ title: string; description: string; priceWei: bigint }> {
  const layer = useDataLayer();
  const scope = useDataScope();
  const queryClient = useQueryClient();
  return useTx(
    (input: { title: string; description: string; priceWei: bigint }) => layer.listDataset(datasetId, input),
    {
      onConfirmed: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.dataset(scope, datasetId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.myDatasets(scope) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.listings(scope) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.sellerStats(scope) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.activity(scope) }),
        ]);
      },
    },
  );
}

/** Buy a listing. run(priceWei) takes the price the buyer saw; the layer rejects a stale one. */
export function useBuyListing(listingId: string): TxController<bigint> {
  const layer = useDataLayer();
  const scope = useDataScope();
  const queryClient = useQueryClient();
  return useTx((expectedPriceWei: bigint) => layer.buyListing(listingId, expectedPriceWei), {
    onConfirmed: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.listing(scope, listingId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.listings(scope) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.hasAccess(scope, listingId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.myPurchases(scope) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.activity(scope) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.sellerStats(scope) }),
      ]);
    },
  });
}

export function useWithdraw(): TxController<void> {
  const layer = useDataLayer();
  const scope = useDataScope();
  const queryClient = useQueryClient();
  return useTx(() => layer.withdraw(), {
    onConfirmed: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.sellerStats(scope) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.activity(scope) }),
      ]);
    },
  });
}
