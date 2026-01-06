
import createMDX from '@next/mdx';

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  // Note: We removed rewrites and now call the API directly with credentials
  // This is necessary for cross-subdomain cookie handling
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'utfs.io',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

const withMDX = createMDX({
  // Disable Rust-based MDX compiler to support JS plugins like remark-gfm
  mdxRs: false,
  options: {
    remarkPlugins: ['remark-gfm'],
  },
});

export default withMDX(nextConfig);
