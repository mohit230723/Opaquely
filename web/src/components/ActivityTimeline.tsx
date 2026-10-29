"use client";

import { useState } from "react";
import type { ActivityEvent, ActivityKind } from "@/data/types";
import { Card } from "@/components/ui/Card";
import { ArrowRightIcon, CheckIcon, TagIcon } from "@/components/icons";
import { describeActivity } from "@/lib/activity";
import { formatDate, relativeTime, shortHash } from "@/lib/format";

const KIND_ICON: Record<ActivityKind, typeof TagIcon> = {
  listed: TagIcon,
  purchased: CheckIcon,
  withdrawn: ArrowRightIcon,
};

/**
 * Vertical timeline, newest first: a 1px rail 12px from the left and one 24px dot per event, the
 * sentence, then a muted row with the relative time (absolute date in the title) and the short tx hash.
 */
export function ActivityTimeline({ events, me }: { events: ActivityEvent[]; me: string | undefined }) {
  // One stable "now" per mount, so every relative time on the page is computed against the same instant.
  const [now] = useState(() => Date.now());
  const sorted = [...events].sort((a, b) => b.at - a.at);

  return (
    <Card>
      <ol className="relative flex flex-col gap-6">
        <span aria-hidden="true" className="absolute bottom-3 left-3 top-3 w-px bg-[#1b2550]" />
        {sorted.map((event) => {
          const Icon = KIND_ICON[event.kind];
          return (
            <li key={event.id} className="relative pl-10">
              <span
                aria-hidden="true"
                className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-[#111a42] text-[#38bdf8]"
              >
                <Icon aria-hidden="true" className="h-3.5 w-3.5" />
              </span>
              <p className="text-base wrap-break-word">{describeActivity(event, me)}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted">
                <time dateTime={new Date(event.at).toISOString()} title={formatDate(event.at)}>
                  {relativeTime(event.at, now)}
                </time>
                <span title={event.txHash} className="font-mono">
                  {shortHash(event.txHash)}
                </span>
              </p>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
