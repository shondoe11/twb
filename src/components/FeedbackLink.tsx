import Link from 'next/link';

//* icon-only link to /feedback - same size/shape/colours == ThemeToggle button so they sit as matched pair in header
export default function FeedbackLink() {
  return (
    <Link
      href="/feedback"
      aria-label="Send feedback"
      title="Send feedback"
      className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
    >
      {/*! speech bubble w a pencil - reads as 'write us a message' */}
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.7-.8L3 21l1.9-4.3A8.4 8.4 0 0 1 3 11.5a8.4 8.4 0 0 1 9-8.4 8.4 8.4 0 0 1 9 8.4Z" />
        <path d="m9.5 14 .5-2 4-4 1.5 1.5-4 4-2 .5Z" />
      </svg>
    </Link>
  );
}
