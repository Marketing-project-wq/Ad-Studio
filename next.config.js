/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Lint is run separately (npm run lint); don't fail production builds on it.
  eslint: { ignoreDuringBuilds: true },
  // The app uses plain <img> (not next/image), so the Image Optimizer is
  // intentionally left unconfigured to keep that surface disabled.
};

module.exports = nextConfig;
