// The chain-backed DataLayer. Methods 1 to 7 (listMyDatasets, getDataset, getSellerStats, getChainView,
// createDataset, addBill, listDataset) are wired to the seller screens in Phase 4. Methods 8 to 14
// (listListings, getListing, hasAccess, listMyPurchases, listActivity, buyListing, withdraw) are
// implemented and node-tested here; Phase 5 proves them through the buyer screens.
// Writes always simulate before they send, so a revert decodes by name before the wallet prompt.
// The vendor, the OCR text and the image never reach this file.
import { parseEventLogs, type Abi, type Address, type Hex as ViemHex, type Log } from "viem";
import type { Config } from "wagmi";
import {
  getPublicClient,
  getWalletClient,
  readContract,
  simulateContract,
  waitForTransactionReceipt,
  writeContract,
} from "wagmi/actions";
import { getDeployment, type Deployment } from "@/contracts";
import { CATEGORIES, isCategoryId } from "@/lib/categories";
import { HARDHAT_CHAIN_ID } from "@/lib/constants";
import { decryptHandles, encryptBill, encryptInsights } from "@/lib/fhe";
import { declaredCategories } from "@/lib/session-bills";
import {
  ReadableTxError,
  USER_REJECTED_REASON,
  WRONG_NETWORK_REASON,
  decryptFailureReason,
  encryptFailureReason,
} from "@/lib/tx-errors";
import type { DataLayer } from "../data-layer";
import { getContractEventsChunked, waitForHead, type LogsClient } from "./logs";

/** A Purchased log as the purchases read uses it. */
type PurchasedLog = { args: unknown; transactionHash: string };
import type {
  ActivityEvent,
  BillFields,
  ChainViewRow,
  Dataset,
  DatasetAnalytics,
  Hex,
  MlInsights,
  Listing,
  Purchase,
  TxHandle,
  TxReceipt,
} from "../types";

export interface LiveOptions {
  config: Config;
  address?: Hex;
  chainId: number;
}

const MAX_UINT64 = (1n << 64n) - 1n;
const MAX_UINT32 = (1n << 32n) - 1n;
const PAGE = 50n;
const ZERO = "0x0000000000000000000000000000000000000000";

interface ChainDataset {
  id: bigint;
  owner: Hex;
  name: string;
  recordCount: number;
  isSealed: boolean;
  createdAt: bigint;
}
interface ChainListing {
  id: bigint;
  datasetId: bigint;
  seller: Hex;
  title: string;
  description: string;
  priceWei: bigint;
  recordCount: number;
  categoryMask: number;
  listedAt: bigint;
  salesCount: number;
}
type ContractRefLike = { address: Address; abi: Abi };

const revert = (reason: string) => new ReadableTxError(reason, "reverted");
const toMs = (seconds: bigint | number) => Number(seconds) * 1000;
const parseId = (id: string): bigint | null => (/^\d{1,18}$/.test(id) ? BigInt(id) : null);

/** Bit k set means "has category k" (seller-declared, public, unverified). */
export function categoriesToMask(categories: readonly number[] | undefined): number {
  let mask = 0;
  for (const c of categories ?? []) if (isCategoryId(c)) mask |= 1 << c;
  return mask;
}
export function maskToCategories(mask: number): number[] {
  return CATEGORIES.filter((c) => (mask & (1 << c.id)) !== 0).map((c) => c.id);
}

export function createLiveDataLayer({ config, address, chainId }: LiveOptions): DataLayer {
  const deployment: Deployment | null = getDeployment(chainId);

  function need(): Deployment {
    if (!deployment) throw new ReadableTxError(WRONG_NETWORK_REASON, "wrong_network");
    return deployment;
  }
  function requireAddress(): Hex {
    if (!address) throw new ReadableTxError("Connect your wallet to continue.");
    return address;
  }

  const read = <T>(c: ContractRefLike, functionName: string, args: readonly unknown[] = []) =>
    readContract(config, { address: c.address, abi: c.abi, functionName, args, chainId } as never) as Promise<T>;

  /**
   * Simulate (eth_call, so a revert comes back as decodable error data), then sign and send.
   * The simulate step also fails BEFORE the wallet prompt, like the stub's pre-checks.
   */
  async function send(c: ContractRefLike, functionName: string, args: readonly unknown[], value?: bigint): Promise<ViemHex> {
    const account = requireAddress();
    const { request } = await simulateContract(config, {
      address: c.address,
      abi: c.abi,
      functionName,
      args,
      account,
      chainId,
      ...(value !== undefined ? { value } : {}),
    } as never);
    return writeContract(config, request as never);
  }

  function handle(hash: ViemHex, createdIdOf?: (logs: readonly Log[]) => string | undefined): TxHandle {
    return {
      hash,
      async wait(): Promise<TxReceipt> {
        const receipt = await waitForTransactionReceipt(config, { hash, chainId });
        // A load-balanced public RPC can still serve the block before the receipt's; wait briefly (never fails).
        if (chainId !== HARDHAT_CHAIN_ID) {
          const pc = getPublicClient(config, { chainId });
          if (pc) await waitForHead(pc as unknown as LogsClient, receipt.blockNumber);
        }
        const createdId = receipt.status === "success" ? createdIdOf?.(receipt.logs) : undefined;
        return {
          status: receipt.status === "success" ? "success" : "reverted",
          blockNumber: receipt.blockNumber,
          ...(createdId ? { createdId } : {}),
        };
      },
    };
  }

  /** The id carried by a named event from one of our contracts, read from the receipt logs. */
  function idFromLogs(c: ContractRefLike, eventName: string, field: string) {
    return (logs: readonly Log[]): string | undefined => {
      const parsed = parseEventLogs({ abi: c.abi, eventName, logs: logs as Log[] });
      const own = parsed.find((l) => l.address.toLowerCase() === c.address.toLowerCase());
      const value = (own?.args as Record<string, unknown> | undefined)?.[field];
      return typeof value === "bigint" ? value.toString() : undefined;
    };
  }

  const toDataset = (d: ChainDataset, listing?: ChainListing): Dataset => ({
    id: d.id.toString(),
    name: d.name,
    owner: d.owner,
    billCount: Number(d.recordCount),
    // Sealing only happens inside listDataset, so a sealed dataset on chain is a listed one.
    status: d.isSealed ? "listed" : "open",
    categories: listing ? maskToCategories(listing.categoryMask) : [],
    createdAt: toMs(d.createdAt),
    ...(listing ? { listingId: listing.id.toString(), priceWei: listing.priceWei } : {}),
  });

  const toListing = (l: ChainListing): Listing => ({
    id: l.id.toString(),
    datasetId: l.datasetId.toString(),
    seller: l.seller,
    title: l.title,
    description: l.description,
    priceWei: l.priceWei,
    recordCount: Number(l.recordCount),
    categories: maskToCategories(l.categoryMask),
    listedAt: toMs(l.listedAt),
  });

  const layer: DataLayer = {
    // ---- reads ----

    async listMyDatasets() {
      if (!address) return [];
      const d = need();
      const [datasets, listings] = await Promise.all([
        read<ChainDataset[]>(d.registry, "datasetsByOwner", [address]),
        read<ChainListing[]>(d.market, "listingsBySeller", [address]),
      ]);
      const byDataset = new Map(listings.map((l) => [l.datasetId.toString(), l]));
      return datasets.map((x) => toDataset(x, byDataset.get(x.id.toString())));
    },

    async getDataset(id) {
      const datasetId = parseId(id);
      if (!address || datasetId === null) return null;
      const d = need();
      const row = await read<ChainDataset>(d.registry, "getDataset", [datasetId]);
      if (row.owner === ZERO || row.owner.toLowerCase() !== address.toLowerCase()) return null;
      const listingId = await read<bigint>(d.market, "listingOfDataset", [datasetId]);
      const listing = listingId > 0n ? await read<ChainListing>(d.market, "getListing", [listingId]) : undefined;
      return toDataset(row, listing);
    },

    async getSellerStats() {
      if (!address) return { datasets: 0, listings: 0, sales: 0, withdrawableWei: 0n };
      const d = need();
      const [datasets, stats] = await Promise.all([
        read<ChainDataset[]>(d.registry, "datasetsByOwner", [address]),
        read<readonly [bigint, bigint, bigint]>(d.market, "sellerStats", [address]),
      ]);
      return { datasets: datasets.length, listings: Number(stats[0]), sales: Number(stats[1]), withdrawableWei: stats[2] };
    },

    async getChainView(datasetId) {
      const id = parseId(datasetId);
      if (!address || id === null) return [];
      const d = need();
      // Handles are public on chain, but this panel is the seller's own view.
      if (!(await layer.getDataset(datasetId))) return [];
      const rows = await read<{ index: number; amountCents: Hex; category: Hex; dateDays: Hex }[]>(
        d.registry,
        "getBillHandles",
        [id],
      );
      return rows.map<ChainViewRow>((r) => ({
        index: Number(r.index),
        amountHandle: r.amountCents,
        categoryHandle: r.category,
        dateHandle: r.dateDays,
      }));
    },

    async decryptAnalytics(datasetId) {
      const me = requireAddress();
      const id = parseId(datasetId);
      if (id === null) throw revert("Dataset not found.");
      const d = need();
      const [row, aggregates, threshold, insightRow] = await Promise.all([
        read<ChainDataset>(d.registry, "getDataset", [id]),
        read<readonly [readonly Hex[], Hex, Hex, Hex]>(d.registry, "getAggregates", [id]),
        read<bigint>(d.registry, "anomalyThresholdCents"),
        // A registry deployed before Milestone 2 has no getInsights: treat it as "no insights yet".
        read<readonly [number, readonly Hex[], Hex, Hex, readonly Hex[]]>(d.registry, "getInsights", [id]).catch(
          () => [0, [], ZERO, ZERO, []] as const,
        ),
      ]);
      const [monthStart, monthTotals, forecast, mlAnomalyCount, scoreBuckets] = insightRow;
      const hasInsights = Number(monthStart) !== 0;
      if (!row.owner || row.owner === ZERO) throw revert("Dataset not found.");
      const [categoryTotals, grandTotal, recordCount, anomalyCount] = aggregates;
      // Ask the ACL before asking the wallet to sign: a wallet without a grant gets a plain refusal.
      const isOwner = row.owner.toLowerCase() === me.toLowerCase();
      if (!isOwner && !(await read<boolean>(d.registry, "canAccess", [grandTotal, me]))) {
        throw new ReadableTxError("This wallet has no access to these analytics. Buy the dataset first.", "reverted");
      }
      const publicClient = getPublicClient(config, { chainId });
      const walletClient = await getWalletClient(config, { chainId, account: me });
      if (!publicClient || !walletClient) throw new ReadableTxError("Connect your wallet to continue.");
      // Only the aggregate handles are sent for decryption; the per-bill handles never are.
      const handles: Hex[] = [...categoryTotals, grandTotal, recordCount, anomalyCount];
      if (hasInsights) handles.push(...monthTotals, forecast, mlAnomalyCount, ...scoreBuckets);
      let clear: bigint[];
      try {
        clear = await decryptHandles(chainId, { publicClient, walletClient } as never, d.registry.address, handles);
      } catch (e) {
        const rejected = e instanceof Error && (e.name === "SigningRejectedError" || (e as { code?: unknown }).code === 4001);
        throw new ReadableTxError(rejected ? USER_REJECTED_REASON : decryptFailureReason(chainId), rejected ? "user_rejected" : "unknown");
      }
      const n = categoryTotals.length;
      const result: DatasetAnalytics = {
        datasetId,
        categoryTotalsCents: clear.slice(0, n),
        grandTotalCents: clear[n],
        billCount: Number(clear[n + 1]),
        anomalyCount: Number(clear[n + 2]),
        anomalyThresholdCents: threshold,
        insights: null,
      };
      if (hasInsights) {
        const rest = clear.slice(n + 3);
        result.insights = {
          monthStart: Number(monthStart) - 1,
          monthTotalsCents: rest.slice(0, 6),
          forecastCents: rest[6],
          mlAnomalyCount: Number(rest[7]),
          scoreBuckets: rest.slice(8, 13).map(Number),
        };
      }
      return result;
    },

    async decryptOwnBills(datasetId) {
      const me = requireAddress();
      const id = parseId(datasetId);
      if (id === null) throw revert("Dataset not found.");
      const d = need();
      const row = await read<ChainDataset>(d.registry, "getDataset", [id]);
      if (row.owner.toLowerCase() !== me.toLowerCase()) throw revert("Only the seller can read these bills.");
      const rows = await read<{ amountCents: Hex; category: Hex; dateDays: Hex }[]>(d.registry, "getBillHandles", [id]);
      const publicClient = getPublicClient(config, { chainId });
      const walletClient = await getWalletClient(config, { chainId, account: me });
      if (!publicClient || !walletClient) throw new ReadableTxError("Connect your wallet to continue.");
      // The relayer caps one user decryption at 2048 bits; 15 bills are 15 x 104 bits. The permit is reused.
      const out: BillFields[] = [];
      for (let i = 0; i < rows.length; i += 15) {
        const chunk = rows.slice(i, i + 15);
        let clear: bigint[];
        try {
          clear = await decryptHandles(
            chainId,
            { publicClient, walletClient } as never,
            d.registry.address,
            chunk.flatMap((r) => [r.amountCents, r.category, r.dateDays]),
          );
        } catch (e) {
          const rejected = e instanceof Error && (e.name === "SigningRejectedError" || (e as { code?: unknown }).code === 4001);
          throw new ReadableTxError(rejected ? USER_REJECTED_REASON : decryptFailureReason(chainId), rejected ? "user_rejected" : "unknown");
        }
        for (let j = 0; j < chunk.length; j++) {
          out.push({ amountCents: clear[j * 3], category: Number(clear[j * 3 + 1]), dateDays: Number(clear[j * 3 + 2]) });
        }
      }
      return out;
    },

    async listListings() {
      const d = need();
      const out: Listing[] = [];
      for (let offset = 0n; ; offset += PAGE) {
        const page = await read<ChainListing[]>(d.market, "getListings", [offset, PAGE]);
        out.push(...page.map(toListing));
        if (BigInt(page.length) < PAGE) break;
      }
      return out; // the contract returns newest first
    },

    async getListing(id) {
      const listingId = parseId(id);
      if (listingId === null) return null;
      const row = await read<ChainListing>(need().market, "getListing", [listingId]);
      return row.id === 0n ? null : toListing(row);
    },

    async hasAccess(listingId) {
      const id = parseId(listingId);
      if (!address || id === null) return false;
      return read<boolean>(need().market, "hasAccess", [id, address]);
    },

    async listMyPurchases() {
      if (!address) return [];
      const d = need();
      const client = getPublicClient(config, { chainId });
      if (!client) return [];
      const [rows, logs] = await Promise.all([
        read<{ listingId: bigint; priceWei: bigint; purchasedAt: bigint }[]>(d.market, "purchasesByBuyer", [address]),
        getContractEventsChunked(
          client as unknown as LogsClient,
          {
            address: d.market.address,
            abi: d.market.abi,
            eventName: "Purchased",
            args: { buyer: address },
            fromBlock: d.deployBlock,
          },
          { chainId },
        ),
      ]);
      const hashById = new Map(
        (logs as PurchasedLog[]).map((l) => [String((l.args as { listingId: bigint }).listingId), l.transactionHash as Hex]),
      );
      // Every purchasesByBuyer row is a purchase by this wallet: the contract sets the purchased flag in
      // the same transaction that pushes the row, so hasAccess is true by construction here. The listing
      // page still reads access per listing from Marketplace.hasAccess (MKT-08).
      // The per-row listing reads are independent, so they run in parallel; Promise.all keeps row order.
      const out: Purchase[] = await Promise.all(
        rows.map(async (r) => {
          const listing = await read<ChainListing>(d.market, "getListing", [r.listingId]);
          return {
            listingId: r.listingId.toString(),
            datasetId: listing.datasetId.toString(),
            title: listing.title,
            seller: listing.seller,
            priceWei: r.priceWei,
            txHash: hashById.get(r.listingId.toString()) ?? ("0x" as Hex),
            purchasedAt: toMs(r.purchasedAt),
            hasAccess: true,
          };
        }),
      );
      return out.reverse(); // newest first
    },

    async listActivity() {
      const d = need();
      const client = getPublicClient(config, { chainId });
      if (!client) return [];
      // deployBlock is the only lower bound (never block 0). Purchase titles are joined from the Listed
      // events of the same range. Off the local chain the reads are chunked (public RPCs cap eth_getLogs
      // ranges); on the local chain each is one call.
      const common = { address: d.market.address, abi: d.market.abi, fromBlock: d.deployBlock } as const;
      const [listed, bought, withdrawn] = await Promise.all([
        getContractEventsChunked(client as unknown as LogsClient, { ...common, eventName: "Listed" }, { chainId }),
        getContractEventsChunked(client as unknown as LogsClient, { ...common, eventName: "Purchased" }, { chainId }),
        getContractEventsChunked(client as unknown as LogsClient, { ...common, eventName: "Withdrawn" }, { chainId }),
      ]);
      type Ev = {
        args: Record<string, unknown>;
        transactionHash: string | null;
        logIndex: number | null;
        blockNumber: bigint | null;
      };
      const order = (l: Ev) => (l.blockNumber ?? 0n) * 1000n + BigInt(l.logIndex ?? 0);
      const base = (l: Ev) => ({ id: `${l.transactionHash}-${l.logIndex}`, txHash: l.transactionHash as Hex });
      const titles = new Map<string, string>();
      const events: (ActivityEvent & { order: bigint })[] = [];
      for (const l of listed as unknown as Ev[]) {
        const a = l.args as { listingId: bigint; seller: Hex; priceWei: bigint; title: string; at: bigint };
        titles.set(a.listingId.toString(), a.title);
        events.push({ ...base(l), kind: "listed", actor: a.seller, listingId: a.listingId.toString(), title: a.title, amountWei: a.priceWei, at: toMs(a.at), order: order(l) });
      }
      for (const l of bought as unknown as Ev[]) {
        const a = l.args as { listingId: bigint; buyer: Hex; priceWei: bigint; at: bigint };
        events.push({ ...base(l), kind: "purchased", actor: a.buyer, listingId: a.listingId.toString(), title: titles.get(a.listingId.toString()), amountWei: a.priceWei, at: toMs(a.at), order: order(l) });
      }
      for (const l of withdrawn as unknown as Ev[]) {
        const a = l.args as { seller: Hex; amountWei: bigint; at: bigint };
        events.push({ ...base(l), kind: "withdrawn", actor: a.seller, amountWei: a.amountWei, at: toMs(a.at), order: order(l) });
      }
      events.sort((x, y) => (y.order > x.order ? 1 : y.order < x.order ? -1 : 0));
      return events.map((e) => {
        const { order: _order, ...rest } = e;
        void _order;
        return rest;
      });
    },

    // ---- writes ----

    async createDataset({ name }) {
      const trimmed = name.trim();
      if (trimmed.length < 1 || trimmed.length > 60) {
        throw new ReadableTxError("Give your dataset a name (1 to 60 characters).");
      }
      const d = need();
      const hash = await send(d.registry, "createDataset", [trimmed]);
      return handle(hash, idFromLogs(d.registry, "DatasetCreated", "datasetId"));
    },

    async addBill(datasetId: string, bill: BillFields) {
      const me = requireAddress();
      const id = parseId(datasetId);
      if (id === null) throw revert("Dataset not found.");
      if (bill.amountCents <= 0n || bill.amountCents > MAX_UINT64) throw revert("Enter an amount greater than 0.");
      if (!isCategoryId(bill.category)) throw revert("Choose one of the six categories.");
      if (!Number.isInteger(bill.dateDays) || bill.dateDays < 0 || BigInt(bill.dateDays) > MAX_UINT32) {
        throw revert("Enter a valid bill date.");
      }
      const d = need();
      const publicClient = getPublicClient(config, { chainId });
      const walletClient = await getWalletClient(config, { chainId, account: me });
      if (!publicClient || !walletClient) throw new ReadableTxError("Connect your wallet to continue.");
      // One encrypt call, three values, one proof, bound to (registry, this wallet).
      let enc: Awaited<ReturnType<typeof encryptBill>>;
      try {
        enc = await encryptBill(chainId, { publicClient, walletClient } as never, d.registry.address, bill);
      } catch (e) {
        // Never embed the original message: SDK text could echo the values being encrypted.
        throw new ReadableTxError(encryptFailureReason(e));
      }
      const hash = await send(d.registry, "addRecord", [id, enc.amount, enc.category, enc.date, enc.inputProof]);
      return handle(hash);
    },

    async listDataset(datasetId, input) {
      const me = requireAddress();
      const id = parseId(datasetId);
      if (id === null) throw revert("Dataset not found.");
      const d = need();
      // The public category mask comes from the plaintext this tab holds, and only when the tab holds
      // every bill of the dataset (otherwise 0). A missing dataset reads recordCount 0, so the mask is 0
      // and the simulate step reverts with the readable DatasetNotFound.
      const row = await read<ChainDataset>(d.registry, "getDataset", [id]);
      const mask = categoriesToMask(declaredCategories(me, datasetId, Number(row.recordCount)));
      const hash = await send(d.market, "listDataset", [id, input.title.trim(), input.description.trim(), input.priceWei, mask]);
      return handle(hash, idFromLogs(d.market, "Listed", "listingId"));
    },

    async buyListing(listingId, expectedPriceWei) {
      const id = parseId(listingId);
      if (id === null) throw revert("Listing not found.");
      const d = need();
      const hash = await send(d.market, "buyListing", [id, expectedPriceWei], expectedPriceWei);
      return handle(hash);
    },

    async storeInsights(datasetId: string, insights: MlInsights) {
      const me = requireAddress();
      const id = parseId(datasetId);
      if (id === null) throw revert("Dataset not found.");
      if (insights.monthTotalsCents.length !== 6 || insights.scoreBuckets.length !== 5) {
        throw new ReadableTxError("The ML helper returned an unexpected result.");
      }
      const d = need();
      const publicClient = getPublicClient(config, { chainId });
      const walletClient = await getWalletClient(config, { chainId, account: me });
      if (!publicClient || !walletClient) throw new ReadableTxError("Connect your wallet to continue.");
      let enc: Awaited<ReturnType<typeof encryptInsights>>;
      try {
        enc = await encryptInsights(chainId, { publicClient, walletClient } as never, d.registry.address, {
          u64s: [...insights.monthTotalsCents, insights.forecastCents],
          u32s: [BigInt(insights.mlAnomalyCount), ...insights.scoreBuckets.map((b) => BigInt(b))],
        });
      } catch (e) {
        throw new ReadableTxError(encryptFailureReason(e));
      }
      // On-chain monthStart is months since January 1970 plus one, so 0 can mean "no insights".
      const hash = await send(d.registry, "setInsights", [id, insights.monthStart + 1, enc.u64s, enc.u32s, enc.inputProof]);
      return handle(hash);
    },

    async withdraw() {
      const d = need();
      const hash = await send(d.market, "withdraw", []);
      return handle(hash);
    },
  };
  return layer;
}
