import type { DataScope } from "./types";

// Every key is an array of strings: a name, the lowercase address (or "none"), the chain id,
// then any ids. No bigint and no Date in keys (a bigint in a query key throws).
function scoped(name: string, scope: DataScope, ...ids: string[]): string[] {
  return [name, scope.address ? scope.address.toLowerCase() : "none", String(scope.chainId ?? 0), ...ids];
}

export const queryKeys = {
  myDatasets: (scope: DataScope) => scoped("my-datasets", scope),
};
