import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Listing, Purchase } from "@/data/types";

const SELLER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const BUYER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const OTHER = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";

type Q<T> = { status: "pending" | "error" | "success"; data: T | undefined; isError: boolean; refetch: () => Promise<void> };

const mocks = vi.hoisted(() => ({
  account: { address: undefined as string | undefined },
  listings: { status: "success", data: [], isError: false, refetch: () => Promise.resolve() } as unknown as Q<Listing[]>,
  purchases: { status: "success", data: [], isError: false, refetch: () => Promise.resolve() } as unknown as Q<Purchase[]>,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));
vi.mock("wagmi", () => ({ useAccount: () => mocks.account }));
vi.mock("@/data/hooks", () => ({
  useListings: () => mocks.listings,
  useMyPurchases: () => mocks.purchases,
  useBuyListing: () => ({ state: { phase: "idle" }, run: () => Promise.resolve(), reset: () => {} }),
}));

import MarketplacePage from "./page";

function listing(id: string, seller: string, title: string, recordCount: number): Listing {
  return {
    id,
    seller,
    title,
    description: `About ${title}.`,
    priceWei: 50_000_000_000_000_000n,
    categories: [0, 1, 2, 3, 4],
    recordCount,
  } as unknown as Listing;
}

function query<T>(status: Q<T>["status"], data: T | undefined): Q<T> {
  return { status, data, isError: status === "error", refetch: () => Promise.resolve() };
}

function render() {
  return renderToStaticMarkup(<MarketplacePage />);
}

beforeEach(() => {
  mocks.account.address = BUYER;
  mocks.listings = query<Listing[]>("success", []);
  mocks.purchases = query<Purchase[]>("success", []);
});

describe("Marketplace page states", () => {
  it("renders the zero-listings empty state with an Upload action over an empty array", () => {
    mocks.listings = query<Listing[]>("success", []);
    const html = render();
    expect(html).toContain("No datasets for sale yet");
    expect(html).toContain("Sellers list their encrypted datasets here. Check back soon.");
    expect(html).toMatch(/<a href="\/upload"[^>]*>(?:(?!<\/a>).)*Upload/);
    expect(html).not.toContain('data-testid="listing-card"');
    expect(html).not.toContain("Showing ");
    expect(html).not.toContain("No datasets match your filters");
  });

  it("renders six skeleton blocks with aria-busy and Loading datasets while the listings load", () => {
    mocks.listings = query<Listing[]>("pending", undefined);
    const html = render();
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Loading datasets");
    expect(html).not.toContain('data-testid="listing-card"');
  });

  it("renders Could not load datasets with Try again when the first read fails", () => {
    mocks.listings = query<Listing[]>("error", undefined);
    const html = render();
    expect(html).toContain("Could not load datasets");
    expect(html).toContain("Try again");
  });

  it("renders the title and subtitle", () => {
    const html = render();
    expect(html).toContain(">Marketplace</h1>");
    expect(html).toContain("Encrypted datasets from other sellers. Buyers get insights, never single bills.");
  });
});

describe("Marketplace cards", () => {
  const own = listing("listing-own", BUYER, "My own receipts", 1);
  const bought = listing("listing-bought", SELLER, "Groceries I bought", 3);
  const buyable = listing("listing-buy", OTHER, "Fuel receipts", 3);

  function cardsHtml() {
    mocks.listings = query<Listing[]>("success", [own, bought, buyable]);
    mocks.purchases = query<Purchase[]>("success", [{ listingId: "listing-bought" } as unknown as Purchase]);
    const html = render();
    return html.split('data-testid="listing-card"').slice(1);
  }

  it("renders one card per listing with the results line", () => {
    mocks.listings = query<Listing[]>("success", [own, bought, buyable]);
    const html = render();
    expect(html).toContain("Showing 3 of 3 datasets");
    expect(cardsHtml()).toHaveLength(3);
  });

  it("makes the title the only link, to the detail page", () => {
    for (const [i, card] of cardsHtml().entries()) {
      const hrefs = [...card.split("</li>")[0].matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      const detail = hrefs.filter((h) => h.startsWith("/marketplace/"));
      expect(detail, `card ${i}`).toHaveLength(1);
    }
  });

  it("shows Your listing and no Buy on the own card", () => {
    const card = cardsHtml()[0].split("</li>")[0];
    expect(card).toContain("Your listing");
    expect(card).not.toContain("Buy this dataset");
  });

  it("shows Access granted and View in My Datasets, and no Buy, on a bought card", () => {
    const card = cardsHtml()[1].split("</li>")[0];
    expect(card).toContain("Access granted");
    expect(card).toContain("View in My Datasets");
    expect(card).toContain('href="/my-datasets"');
    expect(card).not.toContain("Buy this dataset");
  });

  it("shows Buy this dataset on any other card", () => {
    const card = cardsHtml()[2].split("</li>")[0];
    expect(card).toContain("Buy this dataset");
    expect(card).not.toContain("Your listing");
    expect(card).not.toContain("Access granted");
  });

  it("pluralises bills, caps the category chips at three plus a count, and shows the price", () => {
    const cards = cardsHtml();
    expect(cards[0]).toContain("1 bill<");
    expect(cards[1]).toContain("3 bills");
    expect(cards[2]).toContain("+2");
    expect(cards[2]).toContain("0.05 ETH");
  });

  it("shows a placeholder instead of Buy while the purchases read loads", () => {
    mocks.listings = query<Listing[]>("success", [buyable]);
    mocks.purchases = query<Purchase[]>("pending", undefined);
    const html = render();
    expect(html).not.toContain("Buy this dataset");
    expect(html).not.toContain("Access granted");
  });
});
