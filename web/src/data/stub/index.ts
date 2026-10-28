import type { Dataset, Hex } from "../types";
import type { DataLayer } from "../data-layer";

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

// ---- the layer ----

export function createStubDataLayer(opts: StubOptions): DataLayer {
  const { address, latency } = opts;
  return {
    async listMyDatasets() {
      await beforeRead(address, latency?.readMs);
      if (!address) return [];
      return datasetsFor(address).map((d) => ({ ...d, categories: [...d.categories] }));
    },
  };
}
