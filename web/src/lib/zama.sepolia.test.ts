import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ZamaClients } from "./zama";

// The SDK is mocked: this file pins which relayer and chain config each network gets, not the SDK.
const mocks = vi.hoisted(() => ({
  createConfig: vi.fn(),
  cleartext: vi.fn(),
  web: vi.fn(),
  deployments: {} as Record<number, unknown>,
}));

vi.mock("@/contracts", () => ({ getDeployment: (id: number) => mocks.deployments[id] ?? null }));
vi.mock("@zama-fhe/sdk", () => {
  class ZamaSDK {
    config: unknown;
    terminate = vi.fn();
    constructor(config: unknown) {
      this.config = config;
    }
  }
  return { ZamaSDK, cleartext: mocks.cleartext, memoryStorage: { kind: "memory" } };
});
vi.mock("@zama-fhe/sdk/web", () => ({ web: mocks.web }));
vi.mock("@zama-fhe/sdk/viem", () => ({ createConfig: mocks.createConfig }));
vi.mock("@zama-fhe/sdk/chains", () => ({
  hardhat: { id: 31337, name: "Hardhat", gatewayChainId: 10901 },
  sepolia: { id: 11155111, name: "Sepolia", gatewayChainId: 10901, relayerUrl: "https://relayer.testnet.zama.org" },
}));

const ACCOUNT = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const clients = { publicClient: {}, walletClient: { account: { address: ACCOUNT } } } as unknown as ZamaClients;
const FAKE = { chainId: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mocks.deployments = { 31337: FAKE };
  mocks.cleartext.mockReturnValue({ kind: "cleartext" });
  mocks.web.mockReturnValue({ kind: "web" });
  mocks.createConfig.mockImplementation((arg: unknown) => arg);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getZamaSdk on Sepolia", () => {
  it("refuses Sepolia with the flag off and loads nothing", async () => {
    mocks.deployments = { 31337: FAKE, 11155111: FAKE };
    const { getZamaSdk } = await import("./zama");
    await expect(getZamaSdk(11155111, clients)).rejects.toThrow("31337");
    expect(mocks.createConfig).not.toHaveBeenCalled();
    expect(mocks.web).not.toHaveBeenCalled();
  });

  it("refuses Sepolia with the flag on but no deployment", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_SEPOLIA", "1");
    const { getZamaSdk } = await import("./zama");
    await expect(getZamaSdk(11155111, clients)).rejects.toThrow("31337");
    expect(mocks.createConfig).not.toHaveBeenCalled();
    expect(mocks.web).not.toHaveBeenCalled();
  });

  it("builds the sepolia preset with the web() relayer when enabled, and nothing from the local mock", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_SEPOLIA", "1");
    mocks.deployments = { 31337: FAKE, 11155111: FAKE };
    const { getZamaSdk } = await import("./zama");
    await getZamaSdk(11155111, clients);
    expect(mocks.createConfig).toHaveBeenCalledTimes(1);
    expect(mocks.web).toHaveBeenCalledTimes(1);
    expect(mocks.cleartext).not.toHaveBeenCalled();
    const arg = mocks.createConfig.mock.calls[0][0] as {
      chains: Array<Record<string, unknown>>;
      relayers: Record<string, unknown>;
    };
    expect(arg.chains).toHaveLength(1);
    expect(arg.chains[0].id).toBe(11155111);
    expect(arg.relayers).toEqual({ "11155111": { kind: "web" } });
    expect(arg.chains[0]).not.toHaveProperty("inputSignerPrivateKey");
    expect(arg.chains[0]).not.toHaveProperty("kmsSignerPrivateKey");
    expect(arg.chains[0].gatewayChainId).not.toBe(100733346448153);
  });

  it("keeps the local branch untouched when the flag is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_SEPOLIA", "1");
    mocks.deployments = { 31337: FAKE, 11155111: FAKE };
    const { getZamaSdk } = await import("./zama");
    await getZamaSdk(31337, clients);
    const arg = mocks.createConfig.mock.calls[0][0] as {
      chains: Array<Record<string, unknown>>;
      relayers: Record<string, unknown>;
    };
    expect(mocks.cleartext).toHaveBeenCalledTimes(1);
    expect(mocks.web).not.toHaveBeenCalled();
    expect(arg.chains[0].gatewayChainId).toBe(100733346448153);
    expect(arg.relayers).toEqual({ "31337": { kind: "cleartext" } });
  });
});
