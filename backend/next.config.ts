import type { NextConfig } from "next";


const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // CORS is handled by middleware.ts
};


export default nextConfig;
