import { formatEther } from "viem";
import { BILL_CURRENCY_SYMBOL } from "./constants";

/** "0x1234…abcd": first 6 characters (with 0x) and last 4. */
export function shortAddress(a: string): string {
  if (a.length <= 11) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** Tx hashes and ciphertext handles: first 10 characters, an ellipsis, last 6. */
export function shortHash(h: string): string {
  if (h.length <= 17) return h;
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

/** "0.05 ETH", "0 ETH". Uses formatEther on the bigint, so no float math. Max 6 decimals, truncated. */
export function formatEth(wei: bigint): string {
  const [whole, frac = ""] = formatEther(wei).split(".");
  const trimmed = frac.slice(0, 6).replace(/0+$/, "");
  if (wei > 0n && whole === "0" && trimmed === "") return "<0.000001 ETH";
  return `${whole}${trimmed ? `.${trimmed}` : ""} ETH`;
}

const inGrouping = new Intl.NumberFormat("en-IN");

/** Bill amounts are stored as bigint cents: "₹1,234.50", with Indian digit grouping. */
export function formatBillAmount(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const whole = inGrouping.format(abs / 100n);
  const frac = (abs % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${BILL_CURRENCY_SYMBOL}${whole}.${frac}`;
}

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "30 Oct 2026" from epoch milliseconds. */
export function formatDate(ms: number): string {
  return dateFormat.format(new Date(ms));
}

/** Same format from whole days since the epoch (the on-chain date encoding). */
export function formatDateDays(days: number): string {
  return formatDate(days * 86_400_000);
}

const relative = new Intl.RelativeTimeFormat("en", { numeric: "always" });

/** "2 hours ago". Callers put the absolute date in a title attribute. */
export function relativeTime(ms: number, now: number): string {
  const diff = Math.round((ms - now) / 1000);
  const abs = Math.abs(diff);
  if (abs < 60) return "just now";
  if (abs < 3600) return relative.format(Math.round(diff / 60), "minute");
  if (abs < 86_400) return relative.format(Math.round(diff / 3600), "hour");
  return relative.format(Math.round(diff / 86_400), "day");
}

/** plural(1, "bill") is "1 bill"; plural(3, "bill") is "3 bills". */
export function plural(n: number, one: string, many: string = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
