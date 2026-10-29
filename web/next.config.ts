import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stops `next dev` from writing an AGENTS.md file into web/.
  agentRules: false,
  // Phase 7 routes: old bookmarks land on the new pages. 307 (permanent: false) so no browser caches
  // them. Order matters: a specific source must come before the general one that would also match it.
  async redirects() {
    return [
      { source: "/sell/datasets/new", destination: "/upload", permanent: false },
      { source: "/sell/datasets", destination: "/my-datasets", permanent: false },
      { source: "/sell", destination: "/account", permanent: false },
      { source: "/buy/purchases", destination: "/my-datasets", permanent: false },
      { source: "/buy/:id", destination: "/marketplace/:id", permanent: false },
      { source: "/buy", destination: "/marketplace", permanent: false },
      { source: "/activity", destination: "/account", permanent: false },
      { source: "/role", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
