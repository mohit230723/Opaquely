import { describe, expect, it } from "vitest";
import { queryKeys } from "./keys";
import { CHAIN_POLL_MS, chainPollInterval } from "./polling";
import type { DataScope } from "./types";

const chain: DataScope = { address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", chainId: 31337, source: "chain" };
const stub: DataScope = { ...chain, source: "stub" };

describe("chainPollInterval", () => {
  it("polls every 4 seconds", () => {
    expect(CHAIN_POLL_MS).toBe(4000);
  });

  it("polls the seven chain reads another wallet can change", () => {
    const keys = [
      queryKeys.myDatasets(chain),
      queryKeys.sellerStats(chain),
      queryKeys.listings(chain),
      queryKeys.listing(chain, "1"),
      queryKeys.hasAccess(chain, "1"),
      queryKeys.myPurchases(chain),
      queryKeys.activity(chain),
    ];
    for (const key of keys) expect(chainPollInterval(key)).toBe(4000);
  });

  it("does not poll the seller's own dataset reads", () => {
    expect(chainPollInterval(queryKeys.dataset(chain, "1"))).toBe(false);
    expect(chainPollInterval(queryKeys.chainView(chain, "1"))).toBe(false);
  });

  it("never polls the stub", () => {
    const keys = [
      queryKeys.myDatasets(stub),
      queryKeys.sellerStats(stub),
      queryKeys.dataset(stub, "1"),
      queryKeys.listings(stub),
      queryKeys.listing(stub, "1"),
      queryKeys.hasAccess(stub, "1"),
      queryKeys.myPurchases(stub),
      queryKeys.activity(stub),
      queryKeys.chainView(stub, "1"),
    ];
    for (const key of keys) expect(chainPollInterval(key)).toBe(false);
  });

  it("never polls wagmi-shaped or malformed keys", () => {
    expect(chainPollInterval(["balance", { chainId: 31337 }])).toBe(false);
    expect(chainPollInterval(["readContract", {}])).toBe(false);
    expect(chainPollInterval([])).toBe(false);
    expect(chainPollInterval(["listings"])).toBe(false);
  });
});
