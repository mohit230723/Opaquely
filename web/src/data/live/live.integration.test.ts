// Integration: the live DataLayer against a REAL hardhat node with the contracts deployed
// (npm --prefix contracts run deploy). No browser: wagmi's mock connector signs through the node's
// unlocked dev accounts. Skipped when no node answers on 127.0.0.1:8545 (npm run dev-node).
import { createConfig, http, type Config } from "wagmi";
import { connect } from "wagmi/actions";
import { mock } from "wagmi/connectors";
import { defineChain, getAddress, type Address } from "viem";
import { hardhat } from "wagmi/chains";
import { describe, expect, it } from "vitest";
import { getPublicClient } from "wagmi/actions";
import { createLiveDataLayer } from "./index";
import { getDeployment } from "@/contracts";
import { toReadableError } from "@/lib/tx-errors";
import { getFhevm } from "@/lib/fhe";
import { MAX_BILLS_PER_DATASET, MIN_BILLS_TO_LIST } from "@/lib/constants";
import { recordSessionBill } from "@/lib/session-bills";
import type { DataLayer } from "../data-layer";
import type { Hex } from "../types";

const RPC = "http://127.0.0.1:8545";
const SELLER = getAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
const BUYER = getAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
const chain = defineChain({ ...hardhat, rpcUrls: { default: { http: [RPC] } } });

const nodeUp = await fetch(RPC, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
  signal: AbortSignal.timeout(2000),
}).then((r) => r.ok, () => false);

async function asWallet(account: Address): Promise<{ config: Config; layer: DataLayer }> {
  const config = createConfig({
    chains: [chain],
    connectors: [mock({ accounts: [account] })],
    transports: { [chain.id]: http(RPC) },
  });
  await connect(config, { connector: config.connectors[0] });
  return { config, layer: createLiveDataLayer({ config, address: account as Hex, chainId: chain.id }) };
}

async function confirm(p: Promise<{ hash: Hex; wait(): Promise<{ status: string; createdId?: string }> }>) {
  const h = await p;
  const r = await h.wait();
  expect(r.status).toBe("success");
  return { hash: h.hash, ...r };
}
async function failure(p: Promise<unknown>): Promise<string> {
  try {
    const h = (await p) as { wait(): Promise<{ status: string }> };
    const r = await h.wait();
    return "NO REVERT: " + r.status;
  } catch (e) {
    return toReadableError(e).reason;
  }
}

const day = (iso: string) => Math.round(Date.parse(iso + "T00:00:00Z") / 86_400_000);

describe.skipIf(!nodeUp)("live DataLayer against a hardhat node", () => {
  it("runs the seller flow, the rules, and the buyer flow end to end", async () => {
    const d = getDeployment(31337)!;
    const seller = await asWallet(SELLER);
    const buyer = await asWallet(BUYER);
    // Rerunnable on a used node: compare deltas, never absolute counts.
    const before = await seller.layer.getSellerStats();

    // createDataset: id comes from the DatasetCreated log
    const created = await confirm(seller.layer.createDataset({ name: "October bills" }));
    expect(created.createdId).toMatch(/^\d+$/);
    const id = created.createdId!;
    expect(await seller.layer.getDataset(id)).toMatchObject({ name: "October bills", billCount: 0, status: "open", owner: SELLER });
    // another wallet sees nothing of it
    expect(await buyer.layer.getDataset(id)).toBeNull();

    // addBill x3: one encrypt call with 3 values per bill; report gas
    const bills = [
      { amountCents: 150780n, dateDays: day("2026-10-18"), category: 1 },
      { amountCents: 332240n, dateDays: day("2026-10-12"), category: 0 },
      { amountCents: 834550n, dateDays: day("2026-10-25"), category: 2 },
    ];
    const pc = getPublicClient(seller.config, { chainId: 31337 })!;
    for (const [i, b] of bills.entries()) {
      const t0 = Date.now();
      const tx = await confirm(seller.layer.addBill(id, b));
      const rc = await pc.getTransactionReceipt({ hash: tx.hash });
      expect(rc.gasUsed).toBeLessThan(3_500_000n); // about 2.7M to 3.0M observed
      void t0;
      expect((await seller.layer.getDataset(id))!.billCount).toBe(i + 1);
      // what useAddBill's onConfirmed does in the app: the tab remembers what was typed
      recordSessionBill(SELLER, id, { index: i, draft: { ...b, vendor: "" } });
    }
    const view = await seller.layer.getChainView(id);
    expect(view).toHaveLength(3);
    for (const row of view) for (const h of [row.amountHandle, row.categoryHandle, row.dateHandle]) expect(h).toMatch(/^0x[0-9a-f]{64}$/);
    expect(await buyer.layer.getChainView(id)).toEqual([]);

    // the contract really holds what we encrypted: decrypt the grand total and anomaly count as the seller
    const agg = (await pc.readContract({ address: d.registry.address, abi: d.registry.abi, functionName: "getAggregates", args: [BigInt(id)] })) as readonly unknown[];
    const sdk = await getFhevm(31337, { publicClient: pc, walletClient: (await (await import("wagmi/actions")).getWalletClient(seller.config, { chainId: 31337, account: SELLER })) as never });
    const dec = await sdk.decryption.decryptValues([
      { encryptedValue: agg[1] as Hex, contractAddress: d.registry.address },
      { encryptedValue: agg[3] as Hex, contractAddress: d.registry.address },
    ]);
    expect(dec[agg[1] as Hex]).toBe(150780n + 332240n + 834550n);
    expect(Number(dec[agg[3] as Hex])).toBe(1); /* euint32 decrypts to a number */ // only 8,345.50 is above the 5,000 threshold

    // rules with readable reasons: under-filled listing (merged ABI decodes the registry's TooFewBills)
    const small = await confirm(seller.layer.createDataset({ name: "Too small" }));
    await confirm(seller.layer.addBill(small.createdId!, bills[0]));
    expect(await failure(seller.layer.listDataset(small.createdId!, { title: "x", description: "", priceWei: 10n ** 16n }))).toBe(
      "Add at least 3 bills before listing.",
    );
    expect(await failure(seller.layer.listDataset(id, { title: "x", description: "", priceWei: 0n }))).toBe("Enter a price greater than 0 ETH.");

    // the constants the web copy relies on match the deployed registry
    const pub = getPublicClient(seller.config, { chainId: 31337 })!;
    const readConst = async (name: string) =>
      Number(await pub.readContract({ address: d.registry.address, abi: d.registry.abi, functionName: name }));
    expect(await readConst("MAX_BILLS_PER_DATASET")).toBe(MAX_BILLS_PER_DATASET);
    expect(await readConst("MIN_BILLS_TO_LIST")).toBe(MIN_BILLS_TO_LIST);

    // list with a category mask taken from the bills this tab holds
    const price = 10n ** 17n;
    const listed = await confirm(seller.layer.listDataset(id, { title: "October household", description: "3 bills", priceWei: price }));
    expect(listed.createdId).toMatch(/^\d+$/);
    expect(await seller.layer.getDataset(id)).toMatchObject({ status: "listed", listingId: listed.createdId, priceWei: price, categories: [0, 1, 2] });
    expect(await failure(seller.layer.addBill(id, bills[0]))).toBe("This dataset is sealed. Create a new dataset to add more bills.");
    expect(await failure(seller.layer.listDataset(id, { title: "again", description: "", priceWei: price }))).toBe("This dataset is sealed. Create a new dataset to add more bills.");
    expect(await seller.layer.getSellerStats()).toMatchObject({ listings: before.listings + 1, sales: before.sales });

    // mask fallback: bills the tab never recorded are not declared (mask 0)
    const undeclared = await confirm(seller.layer.createDataset({ name: "Undeclared" }));
    for (const b of bills) await confirm(seller.layer.addBill(undeclared.createdId!, b));
    await confirm(seller.layer.listDataset(undeclared.createdId!, { title: "Undeclared", description: "", priceWei: 10n ** 16n }));
    expect((await seller.layer.getDataset(undeclared.createdId!))!.categories).toEqual([]);

    // buyer side (Phase 5 shape)
    const all = await buyer.layer.listListings();
    const mine = all.find((l) => l.id === listed.createdId)!;
    expect(mine).toMatchObject({ title: "October household", recordCount: 3, categories: [0, 1, 2], priceWei: price });
    expect(await buyer.layer.hasAccess(mine.id)).toBe(false);
    expect(await failure(seller.layer.buyListing(mine.id, price))).toBe("You cannot buy your own listing.");
    expect(await failure(buyer.layer.buyListing(mine.id, price + 1n))).toBe("The price changed. Reload the listing and try again.");
    const bought = await confirm(buyer.layer.buyListing(mine.id, price));
    expect(await buyer.layer.hasAccess(mine.id)).toBe(true);
    expect(await failure(buyer.layer.buyListing(mine.id, price))).toBe("You already own this dataset.");
    const purchases = await buyer.layer.listMyPurchases();
    expect(purchases[0]).toMatchObject({ listingId: mine.id, title: "October household", priceWei: price, txHash: bought.hash });

    expect(await seller.layer.getSellerStats()).toMatchObject({ sales: before.sales + 1, withdrawableWei: before.withdrawableWei + price });
    await confirm(seller.layer.withdraw());
    expect((await seller.layer.getSellerStats()).withdrawableWei).toBe(0n);
    expect(await failure(seller.layer.withdraw())).toBe("Nothing to withdraw yet.");

    const activity = await buyer.layer.listActivity();
    const kinds = activity.map((e) => e.kind);
    expect(kinds.slice(0, 3)).toEqual(["withdrawn", "purchased", "listed"]);
    expect(activity.find((e) => e.kind === "purchased")).toMatchObject({ title: "October household", amountWei: price, actor: BUYER });
  }, 120_000);
});
