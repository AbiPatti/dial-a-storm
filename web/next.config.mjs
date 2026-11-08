/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Build output folder. The Playwright tests build into ".next-e2e" (NEXT_DIST_DIR) so a test
  // run never overwrites the ".next" folder that a running `npm run dev` is serving from.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // No ESLint dependency in this project; type-checking runs through `tsc` during `next build`.
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: ["three"],
  async headers() {
    return [
      {
        source: "/data/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
