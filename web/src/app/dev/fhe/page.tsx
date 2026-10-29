import { notFound } from "next/navigation";
import { FheSpikeClient } from "./FheSpikeClient";

// Dev-only route: hidden (404) in a production build unless ENABLE_DEV_FHE=1 is set in the server's
// environment at runtime. The e2e runner sets it for `next start`. It is deliberately not a
// NEXT_PUBLIC_ variable: those are inlined at build time, and this flag must work without a rebuild.
// Render per request: a prerendered page would bake the flag in at build time.
export const dynamic = "force-dynamic";

const devFheEnabled =() => process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_FHE === "1";

// Server wrapper: reads ?address= here so the server and the client render the same input value.
export default async function FheSpikePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!devFheEnabled()) notFound();
  const params = await searchParams;
  const address = params.address;
  return <FheSpikeClient initialAddress={typeof address === "string" ? address : ""} />;
}
