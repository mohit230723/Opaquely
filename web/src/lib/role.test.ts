import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStoredRole, roleStorageKey, setRole, subscribeRole } from "./role";

function installStorage() {
  const data = new Map<string, string>();
  const stub = {
    getItem: (k: string) => (data.has(k) ? (data.get(k) as string) : null),
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
  vi.stubGlobal("localStorage", stub);
  return data;
}

describe("role store", () => {
  let data: Map<string, string>;
  beforeEach(() => {
    data = installStorage();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds the storage key from the lowercase address", () => {
    expect(roleStorageKey("0xAbC")).toBe("opaquely:role:0xabc");
  });

  it("round-trips a role through storage", () => {
    setRole("0xAbC", "seller");
    expect(data.get("opaquely:role:0xabc")).toBe("seller");
    expect(getStoredRole("0xabc")).toBe("seller");
    expect(getStoredRole("0xABC")).toBe("seller");
  });

  it("can be changed by choosing again", () => {
    setRole("0x1", "seller");
    setRole("0x1", "buyer");
    expect(getStoredRole("0x1")).toBe("buyer");
  });

  it("keeps roles separate per address", () => {
    setRole("0x1", "seller");
    expect(getStoredRole("0x2")).toBeNull();
  });

  it("notifies subscribers on setRole and stops after unsubscribe", () => {
    const cb = vi.fn();
    const off = subscribeRole(cb);
    setRole("0x1", "buyer");
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    setRole("0x1", "seller");
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("reads an unknown stored value as null", () => {
    data.set("opaquely:role:0x1", "admin");
    expect(getStoredRole("0x1")).toBeNull();
  });

  it("reads null when storage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
    });
    expect(getStoredRole("0x1")).toBeNull();
  });
});
