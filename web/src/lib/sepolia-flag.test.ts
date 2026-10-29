import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A fake Deployment stands in for the committed one. 31337 is always present; 11155111 is toggled per test.
const state = vi.hoisted(() => ({ deployments: {} as Record<number, unknown> }));
vi.mock("@/contracts", () => ({ getDeployment: (id: number) => state.deployments[id] ?? null }));

import { resolveDataSource } from "@/data/data-source";
import {
  NETWORK_TOOLTIP,
  SEPOLIA_TOOLTIP,
  isWrongNetwork,
  networkLabel,
  networkTooltip,
  sepoliaEnabled,
  sepoliaFlagOn,
  supportedChainIds,
  wrongNetworkMessage,
} from "@/lib/network";

const FAKE = { chainId: 0 };
const LOCAL_TEXT = "Opaquely runs on the Hardhat local chain (chain 31337). Your wallet is on Ethereum.";
const LOCAL_FAILED = "Could not switch network. Open your wallet and select Hardhat (chain 31337).";

beforeEach(() => {
  state.deployments = { 31337: FAKE };
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function withSepoliaDeployment() {
  state.deployments = { 31337: FAKE, 11155111: FAKE };
}

describe("flag off (unset, true, 0, empty)", () => {
  for (const value of [undefined, "true", "0", ""]) {
    it(`changes nothing for ${JSON.stringify(value)}, even with a Sepolia deployment`, () => {
      if (value !== undefined) vi.stubEnv("NEXT_PUBLIC_ENABLE_SEPOLIA", value);
      withSepoliaDeployment();
      expect(sepoliaFlagOn()).toBe(false);
      expect(sepoliaEnabled()).toBe(false);
      expect(supportedChainIds()).toEqual([31337]);
      expect(isWrongNetwork({ isConnected: true, chainId: 11155111 })).toBe(true);
      expect(resolveDataSource(11155111)).toBe("stub");
      expect(networkTooltip(11155111)).toBe(NETWORK_TOOLTIP);
      const m = wrongNetworkMessage(1);
      expect(m.text).toBe(LOCAL_TEXT);
      expect(m.hint).toBeUndefined();
      expect(m.switchFailed).toBe(LOCAL_FAILED);
      expect(wrongNetworkMessage(11155111).hint).toBeUndefined();
    });
  }
});

describe("flag on, no Sepolia deployment", () => {
  it("keeps Sepolia unsupported and explains why", () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_SEPOLIA", "1");
    expect(sepoliaFlagOn()).toBe(true);
    expect(sepoliaEnabled()).toBe(false);
    expect(supportedChainIds()).toEqual([31337]);
    expect(resolveDataSource(11155111)).toBe("stub");
    expect(wrongNetworkMessage(11155111).hint).toBe(
      "Sepolia is turned on in this build, but no contracts are deployed there yet. Follow the Sepolia runbook in README.md.",
    );
    expect(wrongNetworkMessage(1).hint).toBeUndefined();
    expect(wrongNetworkMessage(1).text).toBe(LOCAL_TEXT);
  });
});

describe("flag on with a Sepolia deployment", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_SEPOLIA", "1");
    withSepoliaDeployment();
  });

  it("supports both chains and uses the live layer for both", () => {
    expect(supportedChainIds()).toEqual([31337, 11155111]);
    expect(isWrongNetwork({ isConnected: true, chainId: 11155111 })).toBe(false);
    expect(isWrongNetwork({ isConnected: true, chainId: 1 })).toBe(true);
    expect(resolveDataSource(11155111)).toBe("chain");
    expect(resolveDataSource(31337)).toBe("chain");
  });

  it("has a Sepolia tooltip and keeps the local one for the local chain", () => {
    expect(networkTooltip(11155111)).toBe(
      "Transactions run on Sepolia, a public test network. Amounts, dates and categories are encrypted with Zama's FHE in this browser.",
    );
    expect(networkTooltip(11155111)).toBe(SEPOLIA_TOOLTIP);
    expect(networkTooltip(31337)).toBe(NETWORK_TOOLTIP);
  });

  it("names both chains in the gate copy", () => {
    const m = wrongNetworkMessage(1);
    expect(m.text).toContain("Hardhat local chain (chain 31337)");
    expect(m.text).toContain("Sepolia (chain 11155111)");
    expect(m.text).toContain("Your wallet is on Ethereum.");
    expect(m.hint).toBeUndefined();
    expect(m.switchFailed).toContain("Sepolia");
  });

  it("still lets the window flag force the stub on Sepolia", () => {
    vi.stubGlobal("window", { __OPAQUELY_DATA: "stub" });
    expect(resolveDataSource(11155111)).toBe("stub");
  });
});

describe("invariant: every supported chain is fully wired", () => {
  const flags = [undefined, "1", "true", "0"];
  const sepoliaStates = [false, true];
  for (const flag of flags) {
    for (const deployed of sepoliaStates) {
      it(`flag ${JSON.stringify(flag)}, Sepolia deployed ${deployed}`, () => {
        if (flag !== undefined) vi.stubEnv("NEXT_PUBLIC_ENABLE_SEPOLIA", flag);
        if (deployed) withSepoliaDeployment();
        for (const id of supportedChainIds()) {
          expect(state.deployments[id], `deployment for ${id}`).toBeDefined();
          expect(resolveDataSource(id), `data source for ${id}`).toBe("chain");
          expect(networkLabel(id), `label for ${id}`).not.toBe("Wrong network");
          expect(isWrongNetwork({ isConnected: true, chainId: id })).toBe(false);
        }
      });
    }
  }
});
