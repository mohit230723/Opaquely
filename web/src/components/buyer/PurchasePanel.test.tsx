import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Listing } from "@/data/types";

const SELLER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const BUYER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

const mocks = vi.hoisted(() => ({
  account: { address: undefined as string | undefined },
  tx: { state: { phase: "idle" } as { phase: string; run?: number; reason?: string; code?: string } },
  access: { isPending: false, isError: false, data: undefined as boolean | undefined, refetch: () => Promise.resolve() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));
vi.mock("wagmi", () => ({ useAccount: () => mocks.account }));
vi.mock("@/data/hooks", () => ({
  useHasAccess: () => mocks.access,
  useBuyListing: () => ({ state: mocks.tx.state, run: () => Promise.resolve(), reset: () => {} }),
}));

import { PurchasePanel, panelKey } from "./PurchasePanel";

const LISTING: Listing = {
  id: "7",
  seller: SELLER,
  title: "Household insights",
  description: "Three bills.",
  priceWei: 50_000_000_000_000_000n,
  categories: [0, 1, 4],
  recordCount: 3,
} as unknown as Listing;

function render() {
  return renderToStaticMarkup(<PurchasePanel listing={LISTING} />);
}

beforeEach(() => {
  mocks.account.address = BUYER;
  mocks.access.isPending = false;
  mocks.access.isError = false;
  mocks.access.data = undefined;
  mocks.tx.state = { phase: "idle" };
});

describe("PurchasePanel access states", () => {
  it("shows the Buy this dataset button when access is false", () => {
    mocks.access.data = false;
    const html = render();
    expect(html).toContain("Buy this dataset");
    expect(html).not.toContain("Access granted");
  });

  it("shows Access granted when access is true", () => {
    mocks.access.data = true;
    expect(render()).toContain("Access granted");
  });

  it("shows the access error with a retry only when the first load failed (no data)", () => {
    mocks.access.isError = true;
    mocks.access.data = undefined;
    const html = render();
    expect(html).toContain("Could not check your access.");
    expect(html).toContain("Try again");
  });

  it("keeps Access granted when a background poll fails after data was loaded (WR-01)", () => {
    mocks.access.isError = true;
    mocks.access.data = true;
    const html = render();
    expect(html).toContain("Access granted");
    expect(html).not.toContain("Could not check your access.");
  });

  it("keeps the Buy button when a background poll fails after access=false was loaded (WR-01)", () => {
    mocks.access.isError = true;
    mocks.access.data = false;
    const html = render();
    expect(html).toContain("Buy this dataset");
    expect(html).not.toContain("Could not check your access.");
  });
});

describe("PurchasePanel wallet switch (WR-02)", () => {
  it("keys the panel by wallet and listing so a wallet switch remounts it", () => {
    mocks.account.address = BUYER;
    const first = PurchasePanel({ listing: LISTING });
    mocks.account.address = SELLER;
    const second = PurchasePanel({ listing: LISTING });
    expect(first.key).toBe(`${BUYER}:7`);
    expect(second.key).toBe(`${SELLER}:7`);
    expect(first.key).not.toBe(second.key);
    // Same wallet, same listing: same identity, so polling never remounts the panel.
    mocks.account.address = BUYER;
    expect(PurchasePanel({ listing: LISTING }).key).toBe(first.key);
  });

  it("changes the key when the listing changes and has a stable key without a wallet", () => {
    expect(panelKey(BUYER, "7")).not.toBe(panelKey(BUYER, "8"));
    expect(panelKey(undefined, "7")).toBe("none:7");
  });
});

describe("PurchasePanel failed buy that turns out to be owned (IN-04)", () => {
  const failed = { phase: "failed", run: 1, reason: "You already own this dataset.", code: "reverted" };

  it("keeps Pay and Try again for a failed buy while access is still false", () => {
    mocks.access.data = false;
    mocks.tx.state = failed;
    const html = render();
    expect(html).toContain("Transaction failed");
    expect(html).toContain("Try again");
    expect(html).toContain("Pay 0.05 ETH");
  });

  it("hides Pay and Try again once access is granted, and keeps the reason and Back to listing", () => {
    mocks.access.data = true;
    mocks.tx.state = failed;
    const html = render();
    expect(html).toContain("You already own this dataset.");
    expect(html).toContain("Back to listing");
    expect(html).not.toContain("Try again");
    expect(html).not.toContain("Pay 0.05 ETH");
  });
});
