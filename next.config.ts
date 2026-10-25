import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config, { dev }) {
    // Browser-automation tools write logs into the repo; without this the dev
    // server rebuilds on every log write and interrupts navigation.
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules/**", "**/.git/**", "**/.playwright-mcp/**"],
      };
    }
    return config;
  },
};

export default nextConfig;
