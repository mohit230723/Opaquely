import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "wagmi";
import { guardDecision, type GuardInput } from "./guard";
import { createWalletReadyStore } from "./wallet-ready";

type Status = GuardInput["status"];
const STATUSES: Status[] = ["connecting", "reconnecting", "connected", "disconnected"];

function input(over: Partial<GuardInput>): GuardInput {
  return { walletReady: true, status: "connected", role: "seller", need: "seller", ...over };
}

describe("guardDecision", () => {
  it("returns loading for every status while the wallet is not ready", () => {
    for (const status of STATUSES) {
      expect(guardDecision(input({ walletReady: false, status }))).toBe("loading");
    }
  });

  it("returns loading while wagmi is connecting or reconnecting", () => {
    expect(guardDecision(input({ status: "connecting" }))).toBe("loading");
    expect(guardDecision(input({ status: "reconnecting" }))).toBe("loading");
  });

  it("sends a disconnected wallet home", () => {
    expect(guardDecision(input({ status: "disconnected" }))).toBe("to-home");
  });

  it("returns loading while the role is unknown", () => {
    expect(guardDecision(input({ role: undefined }))).toBe("loading");
  });

  it("sends a connected wallet with no role to the chooser for every need", () => {
    for (const need of ["seller", "buyer", "any"] as const) {
      expect(guardDecision(input({ role: null, need }))).toBe("to-role");
    }
  });

  it("sends the other role to the chooser", () => {
    expect(guardDecision(input({ role: "buyer", need: "seller" }))).toBe("to-role");
    expect(guardDecision(input({ role: "seller", need: "buyer" }))).toBe("to-role");
  });

  it("allows a matching role", () => {
    expect(guardDecision(input({ role: "seller", need: "seller" }))).toBe("allow");
    expect(guardDecision(input({ role: "buyer", need: "buyer" }))).toBe("allow");
  });

  it("allows either role when the need is any", () => {
    expect(guardDecision(input({ role: "seller", need: "any" }))).toBe("allow");
    expect(guardDecision(input({ role: "buyer", need: "any" }))).toBe("allow");
  });
});

type Listener = (selected: Status, previous: Status) => void;

function fakeConfig(initial: Status) {
  let status = initial;
  const listeners = new Set<Listener>();
  const config = {
    get state() {
      return { status };
    },
    subscribe(selector: (s: { status: Status }) => Status, listener: Listener) {
      const wrapped: Listener = (next, prev) => listener(next, prev);
      listeners.add(wrapped);
      expect(selector({ status })).toBe(status);
      return () => listeners.delete(wrapped);
    },
  };
  const move = (next: Status) => {
    const prev = status;
    status = next;
    for (const l of [...listeners]) l(next, prev);
  };
  return { config: config as unknown as Config, move, listenerCount: () => listeners.size };
}

describe("createWalletReadyStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is false initially and never subscribes to wagmi during creation", () => {
    const { config, listenerCount } = fakeConfig("disconnected");
    const store = createWalletReadyStore(config);
    expect(store.getSnapshot()).toBe(false);
    expect(listenerCount()).toBe(0);
  });

  it("becomes true after a connecting to connected transition", () => {
    const { config, move } = fakeConfig("disconnected");
    const store = createWalletReadyStore(config);
    const cb = vi.fn();
    store.subscribe(cb);
    move("connecting");
    expect(store.getSnapshot()).toBe(false);
    move("connected");
    expect(store.getSnapshot()).toBe(true);
    expect(cb).toHaveBeenCalled();
  });

  it("becomes true after a reconnecting to disconnected transition", () => {
    const { config, move } = fakeConfig("disconnected");
    const store = createWalletReadyStore(config);
    store.subscribe(() => {});
    move("reconnecting");
    expect(store.getSnapshot()).toBe(false);
    move("disconnected");
    expect(store.getSnapshot()).toBe(true);
  });

  it("is true immediately when the status is already connected at subscribe time", () => {
    const { config } = fakeConfig("connected");
    const store = createWalletReadyStore(config);
    store.subscribe(() => {});
    expect(store.getSnapshot()).toBe(true);
  });

  it("becomes true after graceMs when wagmi never reports a transition", () => {
    const { config } = fakeConfig("disconnected");
    const store = createWalletReadyStore(config, 1000);
    store.subscribe(() => {});
    vi.advanceTimersByTime(999);
    expect(store.getSnapshot()).toBe(false);
    vi.advanceTimersByTime(2);
    expect(store.getSnapshot()).toBe(true);
  });

  it("stops listening to wagmi once ready", () => {
    const { config, move, listenerCount } = fakeConfig("disconnected");
    const store = createWalletReadyStore(config);
    store.subscribe(() => {});
    expect(listenerCount()).toBe(1);
    move("connecting");
    move("disconnected");
    expect(listenerCount()).toBe(0);
  });
});
