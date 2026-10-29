// Event reads for chains other than the local one, and the wait for the RPC head after a receipt.
// Public RPCs cap eth_getLogs ranges (provider caps differ, which is why the window halves on an error), and a
// load-balanced RPC can serve a read from a block before the receipt block. The local chain keeps exactly one
// call and no wait, so the local demo behaves as it always did. The viem client is passed in; nothing here
// imports wagmi.
import { HARDHAT_CHAIN_ID } from "@/lib/constants";

/** The two viem public-client methods used here, typed loosely so one helper serves every event read. */
export interface LogsClient {
  getContractEvents: (params: never) => Promise<readonly unknown[]>;
  getBlockNumber: () => Promise<bigint>;
}

const DEFAULT_WINDOW = 2000n;
const MIN_WINDOW = 10n;
const MAX_WINDOW = 50_000n;
// The provider says the window is too big: shrink it. Narrow on purpose, so a throttle message never matches.
const RANGE_ERROR =
  /block range|range (is )?too|exceed.*(range|block)|query returned more|max(imum)? (results|range)|response size exceeded|limited to .*range/i;
// The provider says slow down (HTTP 429): wait and retry the same window. Shrinking the window would only
// send more requests to a provider that is already pushing back.
const THROTTLED = /\b429\b|rate[ -]?limit|too many requests|throttl/i;
const THROTTLE_BACKOFF_MS = 500;
const THROTTLE_BACKOFF_MAX_MS = 4000;
const MAX_THROTTLE_RETRIES = 3;

/** Inclusive windows covering from..to in steps of size. Empty when from is past to. */
export function blockRanges(from: bigint, to: bigint, size: bigint): Array<[bigint, bigint]> {
  if (size <= 0n) throw new Error("blockRanges: size must be positive");
  const out: Array<[bigint, bigint]> = [];
  for (let lo = from; lo <= to; lo += size) {
    const hi = lo + size - 1n;
    out.push([lo, hi > to ? to : hi]);
  }
  return out;
}

/** Window from NEXT_PUBLIC_LOG_CHUNK_BLOCKS: a positive integer clamped to 10..50000, default 2000. */
export function logChunkBlocks(): bigint {
  const raw = process.env.NEXT_PUBLIC_LOG_CHUNK_BLOCKS;
  if (raw === undefined || !/^\d+$/.test(raw.trim())) return DEFAULT_WINDOW;
  const n = BigInt(raw.trim());
  if (n <= 0n) return DEFAULT_WINDOW;
  return n < MIN_WINDOW ? MIN_WINDOW : n > MAX_WINDOW ? MAX_WINDOW : n;
}

/**
 * client.getContractEvents for a chain. On the local chain it is that one call with the same params. Elsewhere
 * it walks params.fromBlock..head in windows, halves the window (floor 10 blocks) when the provider complains
 * about the range, backs off and retries the same window (up to 3 times) when the provider throttles, rethrows
 * any other error at once, and returns the logs in block order.
 */
export async function getContractEventsChunked(
  client: LogsClient,
  params: { fromBlock?: bigint } & Record<string, unknown>,
  {
    chainId,
    size,
    sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
  }: { chainId: number; size?: bigint; sleep?: (ms: number) => Promise<void> },
): Promise<unknown[]> {
  if (chainId === HARDHAT_CHAIN_ID) return [...(await client.getContractEvents(params as never))];
  const head = await client.getBlockNumber();
  let window = size ?? logChunkBlocks();
  let lo = params.fromBlock ?? 0n;
  const out: unknown[] = [];
  let backoff = THROTTLE_BACKOFF_MS;
  let throttled = 0;
  while (lo <= head) {
    const hi = lo + window - 1n > head ? head : lo + window - 1n;
    try {
      const logs = await client.getContractEvents({ ...params, fromBlock: lo, toBlock: hi } as never);
      out.push(...logs);
      lo = hi + 1n;
      throttled = 0;
      backoff = THROTTLE_BACKOFF_MS;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (THROTTLED.test(message)) {
        if (++throttled > MAX_THROTTLE_RETRIES) throw err;
        await sleep(backoff);
        backoff = Math.min(backoff * 2, THROTTLE_BACKOFF_MAX_MS);
        continue;
      }
      if (!RANGE_ERROR.test(message) || window <= MIN_WINDOW) throw err;
      window = window / 2n < MIN_WINDOW ? MIN_WINDOW : window / 2n;
    }
  }
  return out;
}

/**
 * Resolves true once the RPC head has reached blockNumber, false when the timeout passes first. It never
 * throws: a confirmed receipt stays confirmed, and polling corrects a briefly stale read (PD-26).
 */
export async function waitForHead(
  client: Pick<LogsClient, "getBlockNumber">,
  blockNumber: bigint,
  { timeoutMs = 30_000, intervalMs = 1_000 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      if ((await client.getBlockNumber()) >= blockNumber) return true;
    } catch {
      // a failed head read counts as "not yet"
    }
    if (Date.now() >= deadline) return false;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
