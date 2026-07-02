import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */

  turbopack: {
    // Point to the actual workspace root to resolve the conflicting lockfiles
    root: path.resolve(__dirname, "../../"),
  },

  // Allow importing from the workspace core package
  transpilePackages: ["@enactor-estate/core"],

  // Enable server-side features
  serverExternalPackages: [
    "@modelcontextprotocol/sdk",
    "eventsource",
  ],
};

export default nextConfig;
