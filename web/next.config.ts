import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stops `next dev` from writing an AGENTS.md file into web/.
  agentRules: false,
};

export default nextConfig;
