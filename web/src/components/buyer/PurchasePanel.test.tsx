import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Listing } from "@/data/types";

const SELLER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const BUYER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

const mocks = vi.hoisted(() => ({
  account: { address: undefined as string | undefined },
  access: { isPending: false, isError: false, data: undefined as boolean | undefined, refetch: () => Promise.resolve() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));
vi.mock("wagmi", () => ({ useAccount: () => mocks.account }));
vi.mock("@/data/hooks", () => ({
  useHasAccess: () => mocks.access,
  useBuyListing: () => ({ state: { phase: "idle" }, run: () => Promise.resolve(), reset: () => {} }),
}));

import { PurchasePanel } from "./PurchasePanel";

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
});

describe("PurchasePanel access states", () => {
  it("shows the Buy button when access is false", () => {
    mocks.access.data = false;
    const html = render();
    expect(html).toContain("Buy dataset");
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
    expect(html).toContain("Buy dataset");
    expect(html).not.toContain("Could not check your access.");
  });
});
