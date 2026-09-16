import Link from 'next/link';
import TwbIcon from '@/components/TwbIcon';
import ThemeToggle from '@/components/ThemeToggle';
import FeedbackForm from '@/components/FeedbackForm';
import type { Metadata } from 'next';

//& title goes thru root "%s | TWB" template; canonical keeps /feedback indexed as its own page
export const metadata: Metadata = {
  title: 'Feedback',
  description: 'Report a bug, suggest a feature or flag wrong toilet data on TWB - Toilets with Bidets (SG).',
  alternates: { canonical: '/feedback' },
  openGraph: {
    title: 'Feedback | TWB',
    description: 'Report a bug, suggest a feature or flag wrong toilet data on TWB - Toilets with Bidets (SG).',
    url: '/feedback',
    type: 'website',
  },
};

//& feedback pg - linked frm home & about headers, same shell as /about
export default function FeedbackPage() {
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
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              ← Back to map
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4 max-w-2xl">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 md:p-8 text-gray-800 dark:text-gray-100">
          <h2 className="text-2xl font-bold mb-2">Feedback</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
            Found a bug, have an idea, or spotted a toilet that is wrong or missing? Let us know below.
            For fixes to the underlying toilet data you can also contribute directly via the{' '}
            <Link href="/about" className="text-blue-600 dark:text-blue-400 hover:underline">
              community sources
            </Link>
            .
          </p>
          <FeedbackForm />
        </div>
      </main>

      <footer className="bg-white dark:bg-gray-800 shadow-inner mt-8 py-4">
        <div className="container mx-auto px-4 text-center text-sm text-blue-600 dark:text-blue-400">
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
