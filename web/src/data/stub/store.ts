import type { ActivityEvent, Dataset, Hex, Listing, Purchase, TxHandle } from "../types";
import { HARDHAT_CHAIN_ID } from "@/lib/constants";
import { ReadableTxError, WRONG_NETWORK_REASON } from "@/lib/tx-errors";
import { seedAccount, seedGlobalActivity, seedGlobalListings, GROCERIES_LISTING_ID, SEED_END } from "./seed";

export type SeedMode = "demo" | "empty";

export interface StubOptions {
  address?: Hex;
  chainId?: number;
  latency?: { readMs?: number; signMs?: number; confirmMs?: number };
}

// ---- demo controls (external store) ----

interface ControlsSnapshot {
  failNext: boolean;
  failNextRead: boolean;
  seedMode: SeedMode;
}

let controls: ControlsSnapshot = { failNext: false, failNextRead: false, seedMode: "demo" };
const listeners = new Set<() => void>();

function updateControls(patch: Partial<ControlsSnapshot>) {
  const next = { ...controls, ...patch };
  if (
    next.failNext === controls.failNext &&
    next.failNextRead === controls.failNextRead &&
    next.seedMode === controls.seedMode
  ) {
    return;
  }
  controls = next; // new identity only when a value changed
  listeners.forEach((cb) => cb());
}

// ---- in-memory marketplace, seeded lazily ----

/** One wallet's private state. Keyed by lowercase address. */
export interface Account {
  datasets: Dataset[];
  purchases: Purchase[];
  sales: number;
  withdrawableWei: bigint;
}

interface Market {
  listings: Map<string, Listing>;
  activity: ActivityEvent[];
  accounts: Map<string, Account>;
  seeded: Set<string>;
  globalSeeded: boolean;
}

function emptyMarket(): Market {
  return { listings: new Map(), activity: [], accounts: new Map(), seeded: new Set(), globalSeeded: false };
}

let market: Market = emptyMarket();

let txCounter = 0;
let blockCounter = 1000n;
let lastNow = 0;

/** A strictly increasing clock that never reads earlier than the seed, so new events sort first. */
export function stubNow(): number {
  lastNow = Math.max(Date.now(), SEED_END, lastNow + 1);
  return lastNow;
}

function clearStore() {
  market = emptyMarket();
}

export const stubControls = {
  getSnapshot(): ControlsSnapshot {
    return controls;
  },
  setFailNext(v: boolean) {
    updateControls({ failNext: v });
  },
  setFailNextRead(v: boolean) {
    updateControls({ failNextRead: v });
  },
  setSeedMode(m: SeedMode) {
    clearStore(); // the next read reseeds in the new mode, even when the mode did not change
    if (m === controls.seedMode) {
      listeners.forEach((cb) => cb());
      return;
    }
    updateControls({ seedMode: m });
  },
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};

/** Tests only: back to a clean store and default controls. */
export function resetStubStore(): void {
  clearStore();
  txCounter = 0;
  blockCounter = 1000n;
  lastNow = 0;
  controls = { failNext: false, failNextRead: false, seedMode: "demo" };
  listeners.forEach((cb) => cb());
}

// ---- store access ----

function ensureGlobalSeeded(): void {
  if (market.globalSeeded) return;
  market.globalSeeded = true;
  if (controls.seedMode !== "demo") return;
  const listings = seedGlobalListings();
  for (const l of listings) market.listings.set(l.id, l);
  market.activity.push(...seedGlobalActivity(listings));
}

function blankAccount(): Account {
  return { datasets: [], purchases: [], sales: 0, withdrawableWei: 0n };
}

/** An account without seeding, used to credit a seller who is not the connected wallet. */
export function accountFor(address: Hex): Account {
  const key = address.toLowerCase();
  let acct = market.accounts.get(key);
  if (!acct) {
    acct = blankAccount();
    market.accounts.set(key, acct);
  }
  return acct;
}

/** The connected wallet's account, seeded once per wallet in demo mode and empty in empty mode. */
export function seededAccount(address: Hex): Account {
  ensureGlobalSeeded();
  const key = address.toLowerCase();
  const acct = accountFor(address);
  if (market.seeded.has(key)) return acct;
  market.seeded.add(key);
  if (controls.seedMode !== "demo") return acct;
  const groceries = market.listings.get(GROCERIES_LISTING_ID);
  if (!groceries) return acct;
  const seed = seedAccount(key as Hex, groceries);
  acct.datasets.push(...seed.datasets);
  acct.purchases.push(...seed.purchases);
  acct.sales += seed.sales;
  acct.withdrawableWei += seed.withdrawableWei;
  market.listings.set(seed.listing.id, seed.listing);
  market.activity.push(...seed.activity);
  return acct;
}

export function allListings(): Map<string, Listing> {
  ensureGlobalSeeded();
  return market.listings;
}

export function pushActivity(event: ActivityEvent): void {
  market.activity.unshift(event);
}

export function allActivity(): ActivityEvent[] {
  ensureGlobalSeeded();
  return market.activity;
}

let idCounter = 0;
/** Short unique suffix for ids of things created while the demo runs. */
export function nextId(): string {
  return String(++idCounter).padStart(4, "0");
}

// ---- latency ----

/** Deterministic 400 to 900 ms derived from the address, so runs feel the same every time. */
function readDelayMs(address: Hex | undefined, override?: number): number {
  if (override !== undefined) return override;
  const s = (address ?? "0x").toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return 400 + (h % 501);
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Every read goes through here: the latency, then the one-shot simulated read failure. */
export async function beforeRead(address: Hex | undefined, override?: number): Promise<void> {
  await wait(readDelayMs(address, override));
  if (controls.failNextRead) {
    updateControls({ failNextRead: false });
    throw new Error("Simulated read failure.");
  }
}

// ---- transactions ----

/** Deterministic fake hash: "0x" plus 64 hex characters derived from a counter. */
function fakeHash(n: number): Hex {
  let h = (n * 2654435761) >>> 0;
  let out = "";
  while (out.length < 64) {
    h = (Math.imul(h ^ (h >>> 15), 2246822507) + 3266489909) >>> 0;
    out += h.toString(16).padStart(8, "0");
  }
  return `0x${out.slice(0, 64)}` as Hex;
}

/** Hash for an activity event written by this run. */
export function nextTxHash(): Hex {
  return fakeHash(++txCounter);
}

export interface StubTxOptions {
  chainId?: number;
  latency?: StubOptions["latency"];
  /** Runs when the receipt arrives; the store changes only here. Returns the created id, if any. */
  apply: () => string | undefined;
}

/**
 * Simulates one write. Refuses a wrong chain first (NetworkGate normally blocks the UI before
 * this; it mirrors viem ChainMismatchError). The sign delay is the "awaiting signature" phase,
 * the confirm delay is "pending". The store changes only once the receipt resolves.
 */
export async function stubTx(opts: StubTxOptions): Promise<TxHandle> {
  if (opts.chainId !== undefined && opts.chainId !== HARDHAT_CHAIN_ID) {
    throw new ReadableTxError(WRONG_NETWORK_REASON, "wrong_network");
  }
  await wait(opts.latency?.signMs ?? 1200);
  if (controls.failNext) {
    updateControls({ failNext: false });
    throw new ReadableTxError("Simulated failure: execution reverted.", "reverted");
  }
  const hash = nextTxHash();
  return {
    hash,
    async wait() {
      await wait(opts.latency?.confirmMs ?? 1500);
      const createdId = opts.apply();
      return { status: "success", blockNumber: blockCounter++, ...(createdId ? { createdId } : {}) };
    },
  };
}
