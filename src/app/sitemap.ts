import type { MetadataRoute } from 'next';

//& tiny sitemap - the app is a single-page map + about page

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://toiletswithbidets.vercel.app';
  return [
    { url: base, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.5 },
  ];
}
