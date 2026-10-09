import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Spotify only accepts 127.0.0.1 (not localhost) redirect URIs, so dev runs on 127.0.0.1;
  // without this the dev server blocks its JS chunks and HMR there and the page never hydrates.
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
