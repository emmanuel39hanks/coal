import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            { protocol: "https", hostname: "images.unsplash.com" },
            { protocol: "https", hostname: "picsum.photos" },
            // Coal's own CDN for merchant-uploaded images
            { protocol: "https", hostname: "utfs.io" },
            { protocol: "https", hostname: "cdn.usecoal.xyz" },
        ],
    },
};

export default nextConfig;
