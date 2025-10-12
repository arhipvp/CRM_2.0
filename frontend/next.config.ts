import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  output: "standalone",
  env: {
    FRONTEND_PROXY_TIMEOUT: process.env.FRONTEND_PROXY_TIMEOUT ?? "15000",
  },
};

export default nextConfig;
