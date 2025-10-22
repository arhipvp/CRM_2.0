import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    FRONTEND_PROXY_TIMEOUT: process.env.FRONTEND_PROXY_TIMEOUT ?? "15000",
  },
};

export default nextConfig;
