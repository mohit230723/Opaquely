import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ActivityEvent } from "@/data/types";
import { TransactionsPanel } from "./TransactionsPanel";

const ME = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const BASE = Date.UTC(2026, 8, 1, 9, 0, 0);

/** Event i is i minutes after BASE, so a higher i is newer. */
function event(i: number, over: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: `evt-${i}`,
    kind: "listed",
    actor: ME,
    listingId: `listing-${i}`,
    title: `Dataset ${i}`,
    amountWei: 10_000_000_000_000_000n,
    txHash: `0x${i.toString(16).padStart(64, "0")}`,
    at: BASE + i * 60_000,
    ...over,
  };
}

/** n events, newest first (the order deriveSales keeps). */
function events(n: number): ActivityEvent[] {
  return Array.from({ length: n }, (_, k) => event(n - k));
}

const liCount = (html: string) => (html.match(/<li\b/g) ?? []).length;

describe("TransactionsPanel", () => {
  it("shows the latest 20 of 25, the Showing line (polite) and Show more transactions", () => {
    const html = renderToStaticMarkup(<TransactionsPanel events={events(25)} me={ME} />);
    expect(liCount(html)).toBe(20);
    expect(html).toContain("Showing 20 of 25 transactions");
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Show more transactions");
    // Newest first: event 25 is shown, the five oldest (1 to 5) are not.
    expect(html).toContain("&quot;Dataset 25&quot;");
    expect(html).toContain("&quot;Dataset 6&quot;");
    expect(html).not.toContain("&quot;Dataset 5&quot;");
  });

  it("keeps the latest 20 even when the input is not sorted", () => {
    const shuffled = [...events(25)].reverse();
    const html = renderToStaticMarkup(<TransactionsPanel events={shuffled} me={ME} />);
    expect(liCount(html)).toBe(20);
    expect(html).toContain("&quot;Dataset 25&quot;");
    expect(html).not.toContain("&quot;Dataset 5&quot;");
  });

  it("shows exactly 20 with no Showing line and no button", () => {
    const html = renderToStaticMarkup(<TransactionsPanel events={events(20)} me={ME} />);
    expect(liCount(html)).toBe(20);
    expect(html).not.toContain("Showing");
    expect(html).not.toContain("Show more transactions");
  });

  it("renders the empty state with no timeline rail when there are no events", () => {
    const html = renderToStaticMarkup(<TransactionsPanel events={[]} me={ME} />);
    expect(html).toContain("No activity yet");
    expect(html).toContain("Listings, purchases and withdrawals show up here.");
    expect(html).not.toContain("<ol");
    expect(html).not.toContain("Show more transactions");
  });

  it("uses describeActivity wording (my purchase reads You bought ...)", () => {
    const bought = event(1, { kind: "purchased", title: "Groceries Q3", amountWei: 50_000_000_000_000_000n });
    const html = renderToStaticMarkup(<TransactionsPanel events={[bought]} me={ME} />);
    expect(html).toContain("You bought &quot;Groceries Q3&quot; for 0.05 ETH");
    expect(liCount(html)).toBe(1);
  });
});
