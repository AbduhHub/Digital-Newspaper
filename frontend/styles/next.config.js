/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    allowedDevOrigins: ["http://localhost:3000", "http://192.168.29.87:3000"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        // port: "", // 8000
        pathname: "/uploads/**",
      },
    ],
  },
};

module.exports = nextConfig;
