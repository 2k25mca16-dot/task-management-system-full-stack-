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
    const backend =
      process.env.BACKEND_URL || "http://127.0.0.1:8080";
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;