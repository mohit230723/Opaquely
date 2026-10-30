import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

const EXPECTED = [
  ["/sell/datasets/new", "/upload"],
  ["/sell/datasets/:id/add", "/upload?dataset=:id"],
  ["/sell/datasets/:id/list", "/upload?dataset=:id"],
  ["/sell/datasets/:id/chain-view", "/my-datasets"],
  ["/sell/datasets/:id", "/my-datasets"],
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
    // Every destination is a same-origin path: a URL value can fill a segment or the dataset query
    // value, never pick the origin.
    for (const r of table) {
      expect(r.destination.startsWith("/")).toBe(true);
      expect(r.destination.startsWith("//")).toBe(false);
    }
  });

  it("orders the specific sources before the general ones", async () => {
    const sources = (await nextConfig.redirects!()).map((r) => r.source);
    expect(sources.indexOf("/buy/purchases")).toBeLessThan(sources.indexOf("/buy/:id"));
    expect(sources.indexOf("/sell/datasets/new")).toBeLessThan(sources.indexOf("/sell/datasets"));
    // /sell/datasets/new would also match /sell/datasets/:id, and each /sell/datasets/:id/... page
    // must be matched before the bare :id entry.
    const general = sources.indexOf("/sell/datasets/:id");
    expect(general).toBeGreaterThanOrEqual(0);
    expect(sources.indexOf("/sell/datasets/new")).toBeLessThan(general);
    for (const sub of ["add", "list", "chain-view"]) {
      const i = sources.indexOf(`/sell/datasets/:id/${sub}`);
      expect(i, sub).toBeGreaterThanOrEqual(0);
      expect(i, sub).toBeLessThan(general);
    }
  });
});
