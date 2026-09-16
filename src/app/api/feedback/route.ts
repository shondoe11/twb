import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';
import { createRateLimiter, clientIp } from '@/lib/rateLimit';
import { FEEDBACK_CATEGORIES, FEEDBACK_LIMITS, FeedbackCategory } from '@/lib/feedback';

//* feedback api - append-only inbox backed by supabase 'feedback' table (see supabase/schema.sql)
//& POST only: submissions read frm dashboard, never served back to browser

//~ stricter guard than remarks
const isRateLimited = createRateLimiter(3, 60_000);

function isCategory(value: unknown): value is FeedbackCategory {
  return typeof value === 'string' && (FEEDBACK_CATEGORIES as readonly string[]).includes(value);
}

export async function POST(request: NextRequest) {
  if (isRateLimited(clientIp(request.headers))) {
    return NextResponse.json({ error: 'Too many submissions - please wait a minute' }, { status: 429 });
  }

  let body: { category?: unknown; message?: unknown; contact?: unknown; page?: unknown; website?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  //~ honeypot: form renders visually hidden 'website' field real users never fill in - bots do. pretend success so they don't adapt
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return NextResponse.json({ ok: true });
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const contact = typeof body.contact === 'string' ? body.contact.trim() : '';
  const page = typeof body.page === 'string' ? body.page.trim() : '';

  if (!isCategory(body.category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }
  if (message.length > FEEDBACK_LIMITS.message) {
    return NextResponse.json({ error: `Message must be ${FEEDBACK_LIMITS.message} characters or less` }, { status: 400 });
  }
  if (contact.length > FEEDBACK_LIMITS.contact) {
    return NextResponse.json({ error: `Contact must be ${FEEDBACK_LIMITS.contact} characters or less` }, { status: 400 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Feedback service unavailable' }, { status: 503 });
  }

  //~ only same-origin paths are stored fr page - anything else (full urls, junk) is dropped rather than rejected
  const { error } = await supabase.from('feedback').insert({
    category: body.category,
    message,
    contact: contact || null,
    page: page.startsWith('/') && page.length <= 100 ? page : null,
    user_agent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
  });

  if (error) {
    console.error('Error saving feedback:', error.message);
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
