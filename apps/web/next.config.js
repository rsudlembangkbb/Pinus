/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@pinus/shared"],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
