import type { MetadataRoute } from 'next';

//& web app manifest - lets mobile users add twb to their home screen & scores the pwa/installable checks in lighthouse
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TWB - Toilets with Bidets (SG)',
    short_name: 'TWB',
    description: 'Find toilets with bidets across Singapore on an interactive map',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
