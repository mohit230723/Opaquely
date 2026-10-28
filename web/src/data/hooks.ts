"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTx } from "@/lib/use-tx";
import { useDataLayer, useDataScope } from "./provider";
import { queryKeys } from "./keys";

export function useMyDatasets() {
  const layer = useDataLayer();
  const scope = useDataScope();
  return useQuery({
    queryKey: queryKeys.myDatasets(scope),
    queryFn: () => layer.listMyDatasets(),
    enabled: Boolean(scope.address),
  });
}

/** Create a dataset: useTx over DataLayer.createDataset, refreshing the seller queries once confirmed. */
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
