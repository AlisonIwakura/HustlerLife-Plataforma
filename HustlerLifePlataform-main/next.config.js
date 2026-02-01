/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/pixeboxing",
        destination: "/pixeboxing/index.html",
      },
    ];
  },
};

module.exports = nextConfig;
