import { FheSpikeClient } from "./FheSpikeClient";

// Server wrapper: reads ?address= here so the server and the client render the same input value.
export default async function FheSpikePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const address = params.address;
  return <FheSpikeClient initialAddress={typeof address === "string" ? address : ""} />;
}
