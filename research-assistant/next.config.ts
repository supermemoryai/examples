import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @supermemory/bash pulls in native node modules (just-bash → @mongodb-js/zstd
  // → .node binary, node-liblzma) that webpack can't bundle. Mark them as
  // server-external so Next.js requires them at runtime instead.
  serverExternalPackages: [
    "@supermemory/bash",
    "just-bash",
    "@mongodb-js/zstd",
    "node-liblzma",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
