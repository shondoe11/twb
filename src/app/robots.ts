import type { MetadataRoute } from 'next';

//& allow crawlers everywhere except api routes

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/api/',
    },
    sitemap: 'https://toiletswithbidets.vercel.app/sitemap.xml',
  };
}
