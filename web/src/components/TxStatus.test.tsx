import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TxStatus } from "./TxStatus";
import type { Hex, TxReceipt } from "@/data/types";

const HASH = `0x${"ab".repeat(32)}` as Hex;
const RECEIPT: TxReceipt = { status: "success", blockNumber: 1n };

describe("TxStatus", () => {
  it("renders nothing when idle", () => {
    expect(renderToStaticMarkup(<TxStatus state={{ phase: "idle" }} />)).toBe("");
  });

  it("awaiting_signature shows the wallet prompt as a polite status", () => {
    const html = renderToStaticMarkup(<TxStatus state={{ phase: "awaiting_signature", run: 1 }} />);
    expect(html).toContain("Confirm in your wallet");
    expect(html).toContain("Waiting for you to sign the transaction.");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Step 1 of 3");
  });

  it("pending shows the short hash with the full hash in the title", () => {
    const html = renderToStaticMarkup(<TxStatus state={{ phase: "pending", run: 1, hash: HASH }} />);
    expect(html).toContain("Transaction pending");
    expect(html).toContain("0xabababab…ababab");
    expect(html).toContain(`title="${HASH}"`);
    expect(html).toContain("font-mono");
  });

  it("confirmed shows the title and the short hash", () => {
    const html = renderToStaticMarkup(
      <TxStatus state={{ phase: "confirmed", run: 1, hash: HASH, receipt: RECEIPT }} />,
    );
    expect(html).toContain("Transaction confirmed");
    expect(html).toContain("0xabababab…ababab");
    expect(html).toContain("Step 3 of 3");
  });

  it("failed is an alert with the reason and a Try again button only when onRetry is given", () => {
    const state = { phase: "failed", run: 1, reason: "Simulated failure: execution reverted.", code: "reverted" } as const;
    const withRetry = renderToStaticMarkup(<TxStatus state={state} onRetry={() => {}} />);
    expect(withRetry).toContain("Transaction failed");
    expect(withRetry).toContain("Simulated failure: execution reverted.");
    expect(withRetry).toContain('role="alert"');
    expect(withRetry).toContain("Try again");
    expect(renderToStaticMarkup(<TxStatus state={state} />)).not.toContain("Try again");
  });

  it("escapes a hostile reason as text", () => {
    const html = renderToStaticMarkup(
      <TxStatus state={{ phase: "failed", run: 1, reason: "<img src=x onerror=alert(1)>", code: "unknown" }} />,
    );
    expect(html).not.toContain("<img");
  });
});
