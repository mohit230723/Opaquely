import { describe, expect, it } from "vitest";
import { SUPPORTED_CHAIN_IDS, chainDisplayName, isWrongNetwork, networkLabel } from "./network";

describe("isWrongNetwork", () => {
  it("is false while disconnected, whatever chain is reported", () => {
    expect(isWrongNetwork({ isConnected: false, chainId: 1 })).toBe(false);
    expect(isWrongNetwork({ isConnected: false, chainId: undefined })).toBe(false);
  });

  it("is false on Hardhat 31337", () => {
    expect(isWrongNetwork({ isConnected: true, chainId: 31337 })).toBe(false);
  });

  it("is true on any other chain while connected", () => {
    expect(isWrongNetwork({ isConnected: true, chainId: 1 })).toBe(true);
    expect(isWrongNetwork({ isConnected: true, chainId: 11155111 })).toBe(true);
  });

  it("only supports Hardhat in this phase", () => {
    expect(SUPPORTED_CHAIN_IDS).toEqual([31337]);
  });
});

describe("networkLabel", () => {
  it("labels disconnected and Hardhat as the local mock", () => {
    expect(networkLabel(undefined)).toBe("Local FHEVM mock");
    expect(networkLabel(31337)).toBe("Local FHEVM mock");
  });

  it("labels Sepolia as real FHE and other chains as wrong network", () => {
    expect(networkLabel(11155111)).toBe("Sepolia, real FHE");
    expect(networkLabel(1)).toBe("Wrong network");
  });

  it("never claims real FHE for the local chain", () => {
    expect(networkLabel(31337)).not.toMatch(/real FHE/i);
    expect(networkLabel(undefined)).not.toMatch(/real FHE/i);
  });
});

describe("chainDisplayName", () => {
  it("names known chains and falls back to the id", () => {
    expect(chainDisplayName(1)).toBe("Ethereum");
    expect(chainDisplayName(11155111)).toBe("Sepolia");
    expect(chainDisplayName(31337)).toBe("Hardhat");
    expect(chainDisplayName(999)).toBe("chain 999");
  });
});
