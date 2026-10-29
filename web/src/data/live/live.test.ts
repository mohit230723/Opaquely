import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "wagmi";

vi.mock("wagmi/actions", () => ({
  readContract: vi.fn(),
  simulateContract: vi.fn(),
  writeContract: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  getPublicClient: vi.fn(),
  getWalletClient: vi.fn(),
}));
vi.mock("@/lib/fhe", () => ({ encryptBill: vi.fn() }));

import { getPublicClient, getWalletClient, readContract, simulateContract, writeContract } from "wagmi/actions";
import { encryptBill } from "@/lib/fhe";
import { clearSessionBills, recordSessionBill } from "@/lib/session-bills";
import { ENCRYPT_FAILED_REASON, ReadableTxError } from "@/lib/tx-errors";
import { categoriesToMask, createLiveDataLayer, maskToCategories } from "./index";
import type { Hex } from "../types";

const SELLER = "0xF39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as Hex;
const HASH = `0x${"ab".repeat(32)}`;
const mocked = (f: unknown) => f as ReturnType<typeof vi.fn>;

function layer() {
  return createLiveDataLayer({ config: {} as Config, address: SELLER, chainId: 31337 });
}
function tabBills(id: string, categories: number[]) {
  clearSessionBills();
  categories.forEach((category, index) =>
    recordSessionBill(SELLER, id, { index, draft: { amountCents: 100n, dateDays: 20000, category, vendor: "" } }),
  );
}
function lastArg(call: unknown[]): unknown {
  const args = (call[1] as { args: unknown[] }).args;
  return args[args.length - 1];
}

beforeEach(() => {
  vi.clearAllMocks();
  clearSessionBills();
});

describe("category mask", () => {
  it("sets bit k for category k and ignores invalid ids", () => {
    expect(categoriesToMask([0, 1, 4])).toBe(19);
    expect(categoriesToMask([9, -1, 1.5])).toBe(0);
    expect(categoriesToMask(undefined)).toBe(0);
  });
  it("reads a mask back as category ids", () => {
    expect(maskToCategories(19)).toEqual([0, 1, 4]);
  });
});

describe("live layer", () => {
  it("answers a non-numeric dataset id with null and no chain read", async () => {
    expect(await layer().getDataset("abc")).toBeNull();
    expect(mocked(readContract)).not.toHaveBeenCalled();
  });

  it("rejects a zero amount before any wallet call", async () => {
    await expect(layer().addBill("1", { amountCents: 0n, dateDays: 20000, category: 1 })).rejects.toMatchObject({
      reason: "Enter an amount greater than 0.",
    });
    expect(mocked(getWalletClient)).not.toHaveBeenCalled();
  });

  it("turns an encryption error into the fixed reason, with no SDK text and no simulate", async () => {
    mocked(getPublicClient).mockReturnValue({});
    mocked(getWalletClient).mockResolvedValue({});
    mocked(encryptBill).mockRejectedValue(new Error("relayer said 150780 is bad"));
    const err = await layer()
      .addBill("1", { amountCents: 150780n, dateDays: 20000, category: 1 })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ReadableTxError);
    expect((err as ReadableTxError).reason).toBe(ENCRYPT_FAILED_REASON);
    expect((err as ReadableTxError).message).not.toContain("150780");
    expect(mocked(simulateContract)).not.toHaveBeenCalled();
  });

  describe("listDataset mask", () => {
    function chainSays(recordCount: number) {
      mocked(readContract).mockResolvedValue({ id: 7n, owner: SELLER, name: "n", recordCount, isSealed: false, createdAt: 1n });
      mocked(simulateContract).mockResolvedValue({ request: {} });
      mocked(writeContract).mockResolvedValue(HASH);
    }

    it("declares the categories when the tab holds every bill, simulating before it writes", async () => {
      tabBills("7", [1, 0, 4]);
      chainSays(3);
      await layer().listDataset("7", { title: "t", description: "d", priceWei: 1n });
      expect(lastArg(mocked(simulateContract).mock.calls[0])).toBe(19);
      expect(mocked(simulateContract).mock.invocationCallOrder[0]).toBeLessThan(
        mocked(writeContract).mock.invocationCallOrder[0],
      );
    });

    it("declares nothing when the tab holds only some of the bills", async () => {
      tabBills("7", [1, 0]);
      chainSays(3);
      await layer().listDataset("7", { title: "t", description: "d", priceWei: 1n });
      expect(lastArg(mocked(simulateContract).mock.calls[0])).toBe(0);
    });
  });
});

describe("listMyPurchases", () => {
  it("listMyPurchases reads every listing in parallel and returns newest first", async () => {
    const hashA = `0x${"11".repeat(31)}aa`;
    const hashB = `0x${"22".repeat(31)}bb`;
    const pending = new Map<string, (v: unknown) => void>();
    mocked(readContract).mockImplementation((_config: unknown, params: { functionName: string; args: unknown[] }) => {
      if (params.functionName === "purchasesByBuyer") {
        return Promise.resolve([
          { listingId: 1n, priceWei: 10n, purchasedAt: 100n },
          { listingId: 2n, priceWei: 20n, purchasedAt: 200n },
        ]);
      }
      if (params.functionName === "getListing") {
        return new Promise((resolve) => pending.set(String(params.args[0]), resolve));
      }
      return Promise.reject(new Error("unexpected read " + params.functionName));
    });
    mocked(getPublicClient).mockReturnValue({
      getContractEvents: vi.fn().mockResolvedValue([
        { args: { listingId: 1n }, transactionHash: hashA },
        { args: { listingId: 2n }, transactionHash: hashB },
      ]),
    });

    const result = layer().listMyPurchases();
    await new Promise((r) => setTimeout(r, 0));
    // both getListing reads are in flight before either one resolved
    const listingReads = mocked(readContract).mock.calls.filter(
      (c) => (c[1] as { functionName: string }).functionName === "getListing",
    );
    expect(listingReads).toHaveLength(2);
    pending.get("1")!({ id: 1n, seller: SELLER, title: "One" });
    pending.get("2")!({ id: 2n, seller: SELLER, title: "Two" });

    const rows = await result;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ listingId: "2", title: "Two", seller: SELLER, priceWei: 20n, txHash: hashB, purchasedAt: 200000, hasAccess: true });
    expect(rows[1]).toMatchObject({ listingId: "1", title: "One", txHash: hashA, purchasedAt: 100000, hasAccess: true });
  });
});
