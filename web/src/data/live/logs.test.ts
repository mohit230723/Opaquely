import { afterEach, describe, expect, it, vi } from "vitest";
import { blockRanges, getContractEventsChunked, logChunkBlocks, waitForHead, type LogsClient } from "./logs";

const SEPOLIA = 11155111;

type Window = { fromBlock: bigint; toBlock: bigint };

function fakeClient(head: bigint, onCall?: (p: Window) => unknown[] | Error) {
  const calls: Window[] = [];
  const raw = {
    getBlockNumber: vi.fn(async () => head),
    getContractEvents: vi.fn(async (p: Window) => {
      calls.push({ fromBlock: p.fromBlock, toBlock: p.toBlock });
      const r = onCall ? onCall(p) : [`${p.fromBlock}-${p.toBlock}`];
      if (r instanceof Error) throw r;
      return r;
    }),
  };
  return { client: raw as unknown as LogsClient, raw, calls };
}

describe("blockRanges", () => {
  it("splits inclusively", () => {
    expect(blockRanges(0n, 9n, 5n)).toEqual([
      [0n, 4n],
      [5n, 9n],
    ]);
    const r = blockRanges(0n, 10n, 5n);
    expect(r[r.length - 1]).toEqual([10n, 10n]);
  });

  it("is empty when from is past to and rejects a non-positive size", () => {
    expect(blockRanges(5n, 4n, 5n)).toEqual([]);
    expect(() => blockRanges(0n, 9n, 0n)).toThrow();
    expect(() => blockRanges(0n, 9n, -1n)).toThrow();
  });
});

describe("logChunkBlocks", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to 2000 when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_LOG_CHUNK_BLOCKS", undefined as never);
    expect(logChunkBlocks()).toBe(2000n);
  });

  it.each([
    ["500", 500n],
    ["abc", 2000n],
    ["0", 2000n],
    ["-5", 2000n],
    ["5", 10n],
    ["999999", 50000n],
  ])("%s gives %s", (raw, want) => {
    vi.stubEnv("NEXT_PUBLIC_LOG_CHUNK_BLOCKS", raw);
    expect(logChunkBlocks()).toBe(want);
  });
});

describe("getContractEventsChunked", () => {
  it("is one direct call with the same params on the local chain", async () => {
    const { client, raw } = fakeClient(100n, () => ["a", "b"]);
    const params = { fromBlock: 3n, eventName: "Listed" };
    const out = await getContractEventsChunked(client, params, { chainId: 31337 });
    expect(out).toEqual(["a", "b"]);
    expect(raw.getContractEvents).toHaveBeenCalledTimes(1);
    expect(raw.getContractEvents.mock.calls[0]![0]).toBe(params);
    expect(raw.getBlockNumber).not.toHaveBeenCalled();
  });

  it("walks windows in order and concatenates the logs", async () => {
    const { client, calls } = fakeClient(4500n);
    const out = await getContractEventsChunked(client, { fromBlock: 0n }, { chainId: SEPOLIA, size: 2000n });
    expect(calls).toEqual([
      { fromBlock: 0n, toBlock: 1999n },
      { fromBlock: 2000n, toBlock: 3999n },
      { fromBlock: 4000n, toBlock: 4500n },
    ]);
    expect(out).toEqual(["0-1999", "2000-3999", "4000-4500"]);
  });

  it("halves the window on a range error and carries on with the smaller window", async () => {
    const { client, calls } = fakeClient(1999n, (p) =>
      p.toBlock - p.fromBlock + 1n > 1000n
        ? new Error("query exceeds max block range 1000")
        : [`${p.fromBlock}-${p.toBlock}`],
    );
    const out = await getContractEventsChunked(client, { fromBlock: 0n }, { chainId: SEPOLIA, size: 2000n });
    expect(calls[0]).toEqual({ fromBlock: 0n, toBlock: 1999n });
    expect(calls[1]).toEqual({ fromBlock: 0n, toBlock: 999n });
    expect(calls[2]).toEqual({ fromBlock: 1000n, toBlock: 1999n });
    expect(out).toEqual(["0-999", "1000-1999"]);
  });

  it("rethrows a non-range error at once", async () => {
    const { client, calls } = fakeClient(5000n, () => new Error("execution reverted"));
    await expect(
      getContractEventsChunked(client, { fromBlock: 0n }, { chainId: SEPOLIA, size: 2000n }),
    ).rejects.toThrow("execution reverted");
    expect(calls).toHaveLength(1);
  });

  it("stops at a 10-block window when the range error persists", async () => {
    const { client, calls } = fakeClient(5000n, () => new Error("block range too large"));
    await expect(
      getContractEventsChunked(client, { fromBlock: 0n }, { chainId: SEPOLIA, size: 2000n }),
    ).rejects.toThrow("range");
    expect(calls.length).toBeLessThanOrEqual(12);
    const last = calls[calls.length - 1]!;
    expect(last.toBlock - last.fromBlock + 1n).toBe(10n);
  });
});

describe("waitForHead", () => {
  it("is true after one read when the head is already there", async () => {
    const getBlockNumber = vi.fn(async () => 10n);
    expect(await waitForHead({ getBlockNumber }, 10n, { timeoutMs: 40, intervalMs: 5 })).toBe(true);
    expect(getBlockNumber).toHaveBeenCalledTimes(1);
  });

  it("is true once the head catches up on a later poll", async () => {
    let head = 8n;
    const getBlockNumber = vi.fn(async () => head++);
    expect(await waitForHead({ getBlockNumber }, 10n, { timeoutMs: 500, intervalMs: 5 })).toBe(true);
    expect(getBlockNumber.mock.calls.length).toBeGreaterThan(1);
  });

  it("is false, without throwing, when the timeout passes first", async () => {
    const getBlockNumber = vi.fn(async () => 1n);
    expect(await waitForHead({ getBlockNumber }, 10n, { timeoutMs: 40, intervalMs: 5 })).toBe(false);
  });

  it("treats a failed head read as not yet", async () => {
    const getBlockNumber = vi.fn(async () => {
      throw new Error("rate limited");
    });
    expect(await waitForHead({ getBlockNumber }, 10n, { timeoutMs: 30, intervalMs: 5 })).toBe(false);
  });
});
