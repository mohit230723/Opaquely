import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAddress } from "viem";
import type { ZamaClients } from "./zama";

// The SDK is mocked: this file pins the seam (chain guard, caching, account switch, override),
// not the SDK. Test files are outside the guardrails scan.
const mocks = vi.hoisted(() => ({
  createConfig: vi.fn(),
  cleartext: vi.fn(),
  throwOnce: { value: false },
  instances: [] as Array<{ config: unknown; encrypt: ReturnType<typeof vi.fn>; terminate: ReturnType<typeof vi.fn> }>,
}));

const HANDLE = "0x" + "ab".repeat(32);

vi.mock("@zama-fhe/sdk", () => {
  class ZamaSDK {
    config: unknown;
    encrypt = vi.fn(async () => ({ encryptedValues: [HANDLE], inputProof: "0xabcd" }));
    terminate = vi.fn();
    constructor(config: unknown) {
      this.config = config;
      mocks.instances.push(this);
    }
  }
  return { ZamaSDK, cleartext: mocks.cleartext, memoryStorage: { kind: "memory" } };
});
vi.mock("@zama-fhe/sdk/viem", () => ({ createConfig: mocks.createConfig }));
vi.mock("@zama-fhe/sdk/chains", () => ({ hardhat: { id: 31337, name: "Hardhat", gatewayChainId: 10901 } }));

const ACCOUNT_A = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const ACCOUNT_B = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
const CONTRACT = "0x5fbdb2315678afecb367f032d93f642f64180aa3";

function clients(account: string | undefined): ZamaClients {
  return {
    publicClient: {},
    walletClient: { account: account ? { address: account } : undefined },
  } as unknown as ZamaClients;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mocks.instances.length = 0;
  mocks.throwOnce.value = false;
  mocks.cleartext.mockReturnValue({ kind: "cleartext" });
  mocks.createConfig.mockImplementation((arg: unknown) => {
    if (mocks.throwOnce.value) {
      mocks.throwOnce.value = false;
      throw new Error("init failed");
    }
    return arg;
  });
});

describe("zama seam", () => {
  it("refuses any chain other than 31337 before the SDK loads", async () => {
    const { getZamaSdk } = await import("./zama");
    await expect(getZamaSdk(11155111, clients(ACCOUNT_A))).rejects.toThrow("31337");
    await expect(getZamaSdk(1, clients(ACCOUNT_A))).rejects.toThrow("31337");
    expect(mocks.createConfig).not.toHaveBeenCalled();
  });

  it("asks for a wallet when the wallet client has no account", async () => {
    const { getZamaSdk } = await import("./zama");
    await expect(getZamaSdk(31337, clients(undefined))).rejects.toThrow("Connect a wallet first");
    expect(mocks.createConfig).not.toHaveBeenCalled();
  });

  it("reuses one SDK for the same account in a different letter case", async () => {
    const { getZamaSdk } = await import("./zama");
    const first = await getZamaSdk(31337, clients(ACCOUNT_A));
    const second = await getZamaSdk(31337, clients(getAddress(ACCOUNT_A)));
    expect(second).toBe(first);
    expect(mocks.createConfig).toHaveBeenCalledTimes(1);
  });

  it("builds a new SDK for a second account and terminates the first", async () => {
    const { getZamaSdk } = await import("./zama");
    const first = await getZamaSdk(31337, clients(ACCOUNT_A));
    const second = await getZamaSdk(31337, clients(ACCOUNT_B));
    expect(second).not.toBe(first);
    expect(mocks.createConfig).toHaveBeenCalledTimes(2);
    expect((first as unknown as { terminate: ReturnType<typeof vi.fn> }).terminate).toHaveBeenCalledTimes(1);
  });

  it("applies the cleartext chain override on top of the hardhat preset", async () => {
    const { getZamaSdk } = await import("./zama");
    await getZamaSdk(31337, clients(ACCOUNT_A));
    const arg = mocks.createConfig.mock.calls[0][0] as {
      chains: Array<Record<string, unknown>>;
      relayers: Record<number, unknown>;
    };
    expect(arg.chains).toHaveLength(1);
    expect(arg.chains[0].id).toBe(31337);
    expect(arg.chains[0].gatewayChainId).toBe(100733346448153);
    expect(arg.chains[0].verifyingContractAddressInputVerification).toBe("0x6189F6c0c3E40B4a3c72ec86262295D78d845297");
    expect(Object.keys(arg.relayers)).toContain("31337");
  });

  it("does not cache a failed init", async () => {
    const { getZamaSdk } = await import("./zama");
    mocks.throwOnce.value = true;
    await expect(getZamaSdk(31337, clients(ACCOUNT_A))).rejects.toThrow("init failed");
    // Let the rejection handler that clears the cache run before the next call.
    await Promise.resolve();
    const sdk = await getZamaSdk(31337, clients(ACCOUNT_A));
    expect(sdk).toBeDefined();
    expect(mocks.createConfig).toHaveBeenCalledTimes(2);
  });
});

describe("fhe encryptUint64", () => {
  it("encrypts a uint64 with checksummed addresses and returns handle and proof", async () => {
    const { encryptUint64 } = await import("./fhe");
    const result = await encryptUint64(31337, clients(ACCOUNT_A), CONTRACT as `0x${string}`, 4242n);
    expect(result).toEqual({ handle: HANDLE, inputProof: "0xabcd" });
    const encrypt = mocks.instances[0].encrypt;
    expect(encrypt).toHaveBeenCalledWith({
      values: [{ value: 4242n, type: "euint64" }],
      contractAddress: getAddress(CONTRACT),
      userAddress: getAddress(ACCOUNT_A),
    });
  });

  it("refuses a chain other than 31337", async () => {
    const { encryptUint64 } = await import("./fhe");
    await expect(encryptUint64(1, clients(ACCOUNT_A), CONTRACT as `0x${string}`, 1n)).rejects.toThrow("31337");
  });
});
