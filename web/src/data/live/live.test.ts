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
