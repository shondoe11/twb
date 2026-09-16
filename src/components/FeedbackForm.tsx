'use client';
//* form shown on /feedback - posts to /api/feedback. writes to supabase

import { useEffect, useState, FormEvent } from 'react';
import { FEEDBACK_CATEGORIES, FEEDBACK_CATEGORY_LABELS, FEEDBACK_LIMITS, FeedbackCategory } from '@/lib/feedback';

const inputClass =
  'w-full text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500';

const FeedbackForm = () => {
  const [category, setCategory] = useState<FeedbackCategory>('suggestion');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  //~ honeypot - hidden frm real users, bots that autofill every field get silently dropped server-side
  const [website, setWebsite] = useState('');
  //~ remembers which pg user came frm so 'wrong data' report has some context
  const [page, setPage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const ref = document.referrer ? new URL(document.referrer) : null;
      if (ref && ref.origin === window.location.origin) setPage(ref.pathname);
    } catch {
      //~ malformed referrer - context is optional
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === 'sending') return;
    const trimmed = message.trim();
    if (!trimmed) {
      setError('Please write a message first');
      return;
    }

    setStatus('sending');
    setError(null);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, message: trimmed, contact: contact.trim(), page, website }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send feedback');
      }
      setStatus('sent');
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : 'Failed to send feedback');
    }
  };

  if (status === 'sent') {
    return (
      <div className="text-center py-6">
        <p className="text-lg font-semibold text-gray-800 dark:text-gray-100">Thanks for the feedback!</p>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">It has been received and will be looked at soon.</p>
        <button
          type="button"
          onClick={() => {
            setMessage('');
            setContact('');
            setStatus('idle');
          }}
          className="mt-4 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="feedback-category" className="block text-sm font-medium mb-1">
          What is this about?
        </label>
        <select
          id="feedback-category"
          value={category}
          onChange={e => setCategory(e.target.value as FeedbackCategory)}
          className={inputClass}
          disabled={status === 'sending'}
        >
          {FEEDBACK_CATEGORIES.map(value => (
            <option key={value} value={value}>
              {FEEDBACK_CATEGORY_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="feedback-message" className="block text-sm font-medium mb-1">
          Message
        </label>
        <textarea
          id="feedback-message"
          value={message}
          onChange={e => setMessage(e.target.value)}
          maxLength={FEEDBACK_LIMITS.message}
          rows={6}
          required
          placeholder={
            category === 'data'
              ? 'Which toilet, and what is wrong or missing? (name / location helps a lot)'
              : 'Tell us what happened or what you would like to see…'
          }
          className={`${inputClass} resize-y`}
          disabled={status === 'sending'}
        />
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-right">
          {message.length}/{FEEDBACK_LIMITS.message}
        </p>
      </div>

      <div>
        <label htmlFor="feedback-contact" className="block text-sm font-medium mb-1">
          Contact <span className="font-normal text-gray-500 dark:text-gray-400">(optional)</span>
        </label>
        <input
          id="feedback-contact"
          type="text"
          value={contact}
          onChange={e => setContact(e.target.value)}
          maxLength={FEEDBACK_LIMITS.contact}
          placeholder="Email or @handle, only if you want a reply"
          autoComplete="email"
          className={inputClass}
          disabled={status === 'sending'}
        />
      </div>

      {/* honeypot - off-screen & excluded frm tab order / screen readers */}
      <div aria-hidden="true" className="absolute -left-[9999px] top-auto w-px h-px overflow-hidden">
        <label htmlFor="feedback-website">Website</label>
        <input
          id="feedback-website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={e => setWebsite(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={status === 'sending'}
        className="w-full sm:w-auto px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {status === 'sending' ? 'Sending…' : 'Send feedback'}
      </button>
    </form>
  );
};

export default FeedbackForm;
