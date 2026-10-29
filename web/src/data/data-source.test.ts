import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveDataSource } from "./data-source";
import { queryKeys } from "./keys";
import type { DataScope } from "./types";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("resolveDataSource", () => {
  it("gives the stub when the chain is unknown or not local", () => {
    expect(resolveDataSource(undefined)).toBe("stub");
    expect(resolveDataSource(1)).toBe("stub");
    expect(resolveDataSource(11155111)).toBe("stub");
  });
  it("gives the real contracts on 31337 (a deployment is committed)", () => {
    expect(resolveDataSource(31337)).toBe("chain");
  });
  it("lets the window flag force the stub", () => {
    vi.stubGlobal("window", { __OPAQUELY_DATA: "stub" });
    expect(resolveDataSource(31337)).toBe("stub");
  });
  it("lets the build flag force the stub", () => {
    vi.stubEnv("NEXT_PUBLIC_OPAQUELY_DATA", "stub");
    expect(resolveDataSource(31337)).toBe("stub");
  });
  it("lets a window value of chain override the build flag, but never past the chain rule", () => {
    vi.stubEnv("NEXT_PUBLIC_OPAQUELY_DATA", "stub");
    vi.stubGlobal("window", { __OPAQUELY_DATA: "chain" });
    expect(resolveDataSource(31337)).toBe("chain");
    expect(resolveDataSource(1)).toBe("stub");
  });
});

describe("queryKeys", () => {
  it("puts the data source second so a stub-to-live switch never serves cached stub rows", () => {
    const base = { address: "0xF39Fd6e51aad88F6F4ce6aB8827279cffFb92266", chainId: 31337 } as const;
    const stub: DataScope = { ...base, source: "stub" };
    const chain: DataScope = { ...base, source: "chain" };
    for (const [name, build] of Object.entries(queryKeys)) {
      const make = build as (s: DataScope, id: string) => string[];
      const a = make(stub, "1");
      const b = make(chain, "1");
      expect(a[1], name).toBe("stub");
      expect(b[1], name).toBe("chain");
      expect(a, name).not.toEqual(b);
    }
  });
});
