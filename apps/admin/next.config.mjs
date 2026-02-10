/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Fix duplicate module instances from Windows path casing (C:\Dev vs C:\dev)
    config.resolve.symlinks = false;
    return config;
  },
};

export default nextConfig;
