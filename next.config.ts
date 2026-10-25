import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // transformers.js + onnxruntime must stay as Node packages, not be bundled.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "sharp"],
  // onnxruntime-node loads its native binding via a templated require
  // (bin/napi-v6/${platform}/${arch}/...), which output tracing can't follow,
  // so Vercel shipped /api/match without it. Include it explicitly — only the
  // linux/x64 binary Vercel runs on; all platforms together exceed 250 MB.
  outputFileTracingIncludes: {
    "/api/match": [
      "./node_modules/onnxruntime-node/package.json",
      "./node_modules/onnxruntime-node/dist/**",
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/**",
      "./node_modules/onnxruntime-common/**",
    ],
  },
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
