import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

const EXPECTED = [
  ["/sell/datasets/new", "/upload"],
  ["/sell/datasets", "/my-datasets"],
  ["/sell", "/account"],
  ["/buy/purchases", "/my-datasets"],
  ["/buy/:id", "/marketplace/:id"],
  ["/buy", "/marketplace"],
  ["/activity", "/account"],
  ["/role", "/"],
] as const;

describe("next.config redirects", () => {
  it("maps every old route to its new page with a temporary (307) redirect", async () => {
    const table = await nextConfig.redirects!();
    for (const [source, destination] of EXPECTED) {
      const entry = table.find((r) => r.source === source);
      expect(entry, source).toBeDefined();
      expect(entry!.destination).toBe(destination);
      expect(entry!.permanent).toBe(false);
    }
    // Every destination is a static path: no query value can become a redirect target.
    for (const r of table) expect(r.destination.startsWith("/")).toBe(true);
  });

  it("orders the specific sources before the general ones", async () => {
    const sources = (await nextConfig.redirects!()).map((r) => r.source);
    expect(sources.indexOf("/buy/purchases")).toBeLessThan(sources.indexOf("/buy/:id"));
    expect(sources.indexOf("/sell/datasets/new")).toBeLessThan(sources.indexOf("/sell/datasets"));
  });
});
