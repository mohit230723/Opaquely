import type { ActivityEvent } from "@/data/types";
import { formatEth, shortAddress } from "./format";

/** Case-insensitive address comparison. False when either side is missing, so nobody is "You" by accident. */
export function sameAddress(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * One sentence per activity event, following UI-SPEC "Activity". The actor reads "You" when it is
 * the connected address, otherwise the short address. Titles are third-party text: callers render
 * the result as React text only.
 */
export function describeActivity(event: ActivityEvent, me: string | undefined): string {
  const actor = sameAddress(event.actor, me) ? "You" : shortAddress(event.actor);
  const amount = formatEth(event.amountWei ?? 0n);
  const subject = event.title === undefined ? "a dataset" : `"${event.title}"`;
  switch (event.kind) {
    case "listed":
      return `${actor} listed ${subject} for ${amount}`;
    case "purchased":
      return `${actor} bought ${subject} for ${amount}`;
    case "withdrawn":
      return `${actor} withdrew ${amount}`;
  }
}
