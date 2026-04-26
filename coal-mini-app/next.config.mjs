/** @type {import('next').NextConfig} */
const nextConfig = {
    // Mini Apps run inside the World App webview. The main security
    // headers (X-Frame-Options, CSP) that the Coal dashboard uses would
    // break that, so we don't set them here. World App injects its own
    // sandbox.
    reactStrictMode: true,
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'utfs.io' },
            { protocol: 'https', hostname: '*.ufs.sh' },
            { protocol: 'https', hostname: 'images.unsplash.com' },
        ],
    },
    // When the Mini App is loaded via ngrok (or any non-localhost URL),
    // the phone cannot reach http://localhost:3001 directly. We proxy
    // Coal backend calls through this Next.js server so only ONE tunnel
    // is needed. Client code calls `/coal-proxy/api/...` and Next.js
    // forwards to the real backend at COAL_BACKEND_ORIGIN (default localhost:3001).
    async rewrites() {
        const backend = process.env.COAL_BACKEND_ORIGIN || 'http://localhost:3001';
        return [
            { source: '/coal-proxy/api/:path*', destination: `${backend}/api/:path*` },
        ];
    },
};

export default nextConfig;
