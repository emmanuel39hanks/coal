import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    serverExternalPackages: ["@0gfoundation/0g-ts-sdk"],
    images: {
        remotePatterns: [
            { protocol: "https", hostname: "utfs.io" },
            { protocol: "https", hostname: "uploadthing.com" },
            { protocol: "https", hostname: "**.uploadthing.com" },
        ],
    },
};

export default nextConfig;
