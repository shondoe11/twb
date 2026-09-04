import Link from 'next/link';
import TwbIcon from '@/components/TwbIcon';
import type { Metadata } from 'next';

//& title goes through root "%s | TWB" template; canonical keeps /about indexed as its own page
export const metadata: Metadata = {
  title: 'About',
  description: 'About TWB - a community-driven map of public toilets with bidets in Singapore.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About | TWB',
    description: 'About TWB - a community-driven map of public toilets with bidets in Singapore.',
    url: '/about',
    type: 'website',
  },
};

//* about pg - via TWB text in nav + footer
export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="container mx-auto py-4 px-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">
            <Link href="/" className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:opacity-80 transition-opacity" title="Back to map">
              <TwbIcon size={30} />
              TWB
            </Link>
          </h1>
          <Link
            href="/"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Back to map
          </Link>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4 max-w-2xl">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 md:p-8 text-gray-800 dark:text-gray-100">
          <h2 className="text-2xl font-bold mb-4">About TWB</h2>

          <div className="space-y-4 text-sm md:text-base leading-relaxed">
            <p>
              <span className="font-semibold">TWB (Toilets with Bidets)</span> is a
              community-driven map of public toilets in Singapore fitted with bidets.
              Anyone who prefers washing over wiping knows the struggle of finding a
              bidet-equipped toilet while out and about - this site aims to fix that.
            </p>

            <p>
              Every location on the map comes with what the community knows about it:
              which cubicles have bidets, wheelchair-accessible options, unisex
              facilities, and directions hidden in the remarks. Use the filters to
              narrow down by region, facility type, or amenities, and tap any marker
              or list entry for details.
            </p>

            <p>
              <a
                href="https://bit.ly/shondoe11-twb"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
              >
                {/*~ github mark */}
                <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                </svg>
                View project on GitHub
              </a>
            </p>

            <h3 className="text-lg font-semibold pt-2">Data Sources</h3>
            <p>
              All location data is lovingly crowdsourced by the{' '}
              <span className="font-semibold">@toiletswithbidetsg</span> community,
              who maintain the original Google Sheets and Google Maps collections
              this site is built on. This project would not exist without their work -
              find (and contribute to) the original sources here:
            </p>
            <p>
              <a
                href="https://linktr.ee/toiletswithbidetsg"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                linktr.ee/toiletswithbidetsg
              </a>
            </p>

            <p className="text-xs text-gray-500 dark:text-gray-400 pt-4">
              Data syncs automatically from the community sources. Spotted a missing
              or incorrect toilet? Contribute directly through the community&apos;s
              channels above.
            </p>
          </div>
        </div>
      </main>

      <footer className="bg-white dark:bg-gray-800 shadow-inner mt-8 py-4">
        <div className="container mx-auto px-4 text-center text-sm text-gray-600 dark:text-gray-300">
          <p>
            <Link href="/about" className="hover:underline" title="About TWB">
              © {new Date().getFullYear()} TWB - Toilets with Bidets
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
