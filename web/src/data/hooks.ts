"use client";

import { useQuery } from "@tanstack/react-query";
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
