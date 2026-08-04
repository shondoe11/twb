import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  //~ location imageUrl values come frm the community google sheet & can point at any https host - w/o remotePatterns next/image throws at runtime fr remote urls
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
