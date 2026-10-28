import type { Dataset, Hex, TxHandle } from "../types";
import type { DataLayer } from "../data-layer";
import { HARDHAT_CHAIN_ID } from "@/lib/constants";
import { ReadableTxError, WRONG_NETWORK_REASON } from "@/lib/tx-errors";

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

// ---- in-memory store, keyed by lowercase address, seeded lazily ----

const store = new Map<string, Dataset[]>();

let txCounter = 0;
let blockCounter = 1000n;

function clearStore() {
  store.clear();
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
  controls = { failNext: false, failNextRead: false, seedMode: "demo" };
  listeners.forEach((cb) => cb());
}

// ---- seed data (fixed timestamps: no Date.now in the seed) ----

const DAY_MS = 24 * 60 * 60 * 1000;
const SEED_BASE = Date.UTC(2026, 9, 20, 9, 0, 0); // 20 Oct 2026

function seedDatasets(owner: Hex): Dataset[] {
  return [
    {
      id: "household-utilities-2026",
      name: "Household utilities 2026",
      owner,
      billCount: 1,
      status: "open",
      categories: [0],
      createdAt: SEED_BASE,
    },
    {
      id: "groceries-q3",
      name: "Groceries Q3",
      owner,
      billCount: 3,
      status: "open",
      categories: [1, 4],
      createdAt: SEED_BASE + 2 * DAY_MS,
    },
    {
      id: "medical-and-pharmacy",
      name: "Medical and pharmacy",
      owner,
      billCount: 4,
      status: "listed",
      categories: [2, 5],
      createdAt: SEED_BASE + 4 * DAY_MS,
      listingId: "listing-medical-and-pharmacy",
      priceWei: 50_000_000_000_000_000n, // 0.05 ETH
    },
  ];
}

function datasetsFor(address: Hex): Dataset[] {
  const key = address.toLowerCase();
  let rows = store.get(key);
  if (!rows) {
    rows = controls.seedMode === "demo" ? seedDatasets(address.toLowerCase() as Hex) : [];
    store.set(key, rows);
  }
  return rows;
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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function beforeRead(address: Hex | undefined, override?: number): Promise<void> {
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

interface StubTxOptions {
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
async function stubTx(opts: StubTxOptions): Promise<TxHandle> {
  if (opts.chainId !== undefined && opts.chainId !== HARDHAT_CHAIN_ID) {
    throw new ReadableTxError(WRONG_NETWORK_REASON, "wrong_network");
  }
  await wait(opts.latency?.signMs ?? 1200);
  if (controls.failNext) {
    updateControls({ failNext: false });
    throw new ReadableTxError("Simulated failure: execution reverted.", "reverted");
  }
  const hash = fakeHash(++txCounter);
  return {
    hash,
    async wait() {
      await wait(opts.latency?.confirmMs ?? 1500);
      const createdId = opts.apply();
      return { status: "success", blockNumber: blockCounter++, ...(createdId ? { createdId } : {}) };
    },
  };
}

const NAME_ERROR = "Give your dataset a name (1 to 60 characters).";

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "dataset";
}

// ---- the layer ----

export function createStubDataLayer(opts: StubOptions): DataLayer {
  const { address, latency } = opts;
  return {
    async listMyDatasets() {
      await beforeRead(address, latency?.readMs);
      if (!address) return [];
      return datasetsFor(address).map((d) => ({ ...d, categories: [...d.categories] }));
    },

    async createDataset({ name }) {
      const trimmed = name.trim();
      if (trimmed.length < 1 || trimmed.length > 60) throw new ReadableTxError(NAME_ERROR);
      if (!address) throw new ReadableTxError("Connect your wallet to continue.");
      return stubTx({
        chainId: opts.chainId,
        latency,
        apply: () => {
          const rows = datasetsFor(address);
          const base = slugify(trimmed);
          let id = base;
          for (let n = 2; rows.some((d) => d.id === id); n++) id = `${base}-${n}`;
          rows.push({
            id,
            name: trimmed,
            owner: address.toLowerCase() as Hex,
            billCount: 0,
            status: "open",
            categories: [],
            createdAt: Date.now(),
          });
          return id;
        },
      });
    },
  };
}
