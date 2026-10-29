import { describe, expect, it } from "vitest";
import { gateDecision, type GateInput } from "./wallet-gate";

const STATUSES: GateInput["status"][] = ["connecting", "reconnecting", "connected", "disconnected"];

describe("gateDecision", () => {
  it.each(STATUSES)("is loading while the wallet is not ready (%s)", (status) => {
    expect(gateDecision({ walletReady: false, status })).toBe("loading");
  });
  it("is loading while connecting or reconnecting", () => {
    expect(gateDecision({ walletReady: true, status: "connecting" })).toBe("loading");
    expect(gateDecision({ walletReady: true, status: "reconnecting" })).toBe("loading");
  });
  it("asks a disconnected visitor to connect", () => {
    expect(gateDecision({ walletReady: true, status: "disconnected" })).toBe("connect");
  });
  it("allows any connected wallet", () => {
    expect(gateDecision({ walletReady: true, status: "connected" })).toBe("allow");
  });
});
