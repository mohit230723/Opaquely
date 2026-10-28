import type { DataScope } from "./types";

// Every key is an array of strings: a name, the lowercase address (or "none"), the chain id,
// then any ids. No bigint and no Date in keys (a bigint in a query key throws).
function scoped(name: string, scope: DataScope, ...ids: string[]): string[] {
  return [name, scope.address ? scope.address.toLowerCase() : "none", String(scope.chainId ?? 0), ...ids];
}

export const queryKeys = {
  myDatasets: (scope: DataScope) => scoped("my-datasets", scope),
  sellerStats: (scope: DataScope) => scoped("seller-stats", scope),
  dataset: (scope: DataScope, id: string) => scoped("dataset", scope, id),
  listings: (scope: DataScope) => scoped("listings", scope),
  listing: (scope: DataScope, id: string) => scoped("listing", scope, id),
  hasAccess: (scope: DataScope, listingId: string) => scoped("has-access", scope, listingId),
  myPurchases: (scope: DataScope) => scoped("my-purchases", scope),
  activity: (scope: DataScope) => scoped("activity", scope),
  chainView: (scope: DataScope, datasetId: string) => scoped("chain-view", scope, datasetId),
};
