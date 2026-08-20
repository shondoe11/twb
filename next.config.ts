import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  //~ api route reads combined.geojson frm disk at runtime - w/o this the file is nt traced into the serverless bundle on vercel & the api silently returns an empty collection
  outputFileTracingIncludes: {
    '/api/locations': ['./data/combined.geojson'],
  },
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
