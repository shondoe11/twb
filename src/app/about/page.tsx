import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About | TWB - Toilets with Bidets',
  description: 'About TWB - a community-driven map of public toilets with bidets in Singapore.',
};

//* about pg - via the TWB text in the navbar
export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm">
        <div className="container mx-auto py-4 px-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">
            <Link href="/" className="text-blue-600 dark:text-blue-400 hover:opacity-80 transition-opacity" title="Back to map">
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
          <p>© {new Date().getFullYear()} TWB - Toilets with Bidets</p>
          <p className="mt-1">
            <a
              href="https://bit.ly/shondoe11-twb"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              GitHub
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
