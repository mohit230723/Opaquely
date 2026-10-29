"use client";

import { useAccount } from "wagmi";
import { useMyDatasets } from "@/data/hooks";
import { AsyncBoundary } from "@/components/AsyncBoundary";
import { EmptyState } from "@/components/EmptyState";
import { PageShell } from "@/components/PageShell";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/Button";
import { DatasetList } from "@/components/seller/DatasetList";

export default function MyDatasetsPage() {
  const { address } = useAccount();
  const datasets = useMyDatasets();

  return (
    <PageShell title="My datasets" actions={<Button href="/sell/datasets/new">Create dataset</Button>}>
      {!address ? (
        <p className="text-muted">Connect your wallet to continue.</p>
      ) : (
        <AsyncBoundary
          query={datasets}
          thing="datasets"
          skeleton={
            <div className="flex flex-col gap-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          }
          isEmpty={(rows) => rows.length === 0}
          empty={
            <EmptyState heading="No datasets yet" action={{ label: "Create dataset", href: "/sell/datasets/new" }}>
              A dataset is a named group of bills you can seal and sell.
            </EmptyState>
          }
        >
          {(rows) => <DatasetList datasets={rows} />}
        </AsyncBoundary>
      )}
    </PageShell>
  );
}
