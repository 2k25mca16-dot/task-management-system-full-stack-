import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.108.151",
    "192.168.108.151:3000",
    "localhost:3000",
    "127.0.0.1:3000",
    "*.local",
  ],
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8080/api/:path*",
      },
    ];
  },
};

export default nextConfig;
