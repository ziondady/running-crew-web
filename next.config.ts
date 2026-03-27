import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['10.101.222.43', '192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12'],
  output: 'export',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
