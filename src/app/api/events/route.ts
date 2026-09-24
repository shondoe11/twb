import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';
import { createRateLimiter, clientIp } from '@/lib/rateLimit';
import { EVENT_NAMES, EVENT_LIMITS } from '@/lib/analytics';

//* ui interaction events api - append-only, backed by supabase 'events' table (see supabase/schema.sql)
//& POST only: events are queried in dashboard w sql, never served back to browser

//& looser than form apis - a real session can legitimately fire a burst (filter, tap, tap, directions) but nowhere near 1/sec sustained
const isRateLimited = createRateLimiter(60, 60_000);

type Primitive = string | number | boolean;

//& props must be flat object of short primitives - anything nested / oversized is rejected, nt trimmed, so junk never lands in table
function sanitizeProps(value: unknown): Record<string, Primitive> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > EVENT_LIMITS.maxProps) return null;

  const clean: Record<string, Primitive> = {};
  for (const [key, raw] of entries) {
    if (key.length === 0 || key.length > EVENT_LIMITS.maxKeyLength) return null;
    if (typeof raw === 'string') {
      if (raw.length > EVENT_LIMITS.maxValueLength) return null;
      clean[key] = raw;
    } else if (typeof raw === 'number' && Number.isFinite(raw)) {
      clean[key] = raw;
    } else if (typeof raw === 'boolean') {
      clean[key] = raw;
    } else {
      return null;
    }
  }
  return clean;
}

export async function POST(request: NextRequest) {
  if (isRateLimited(clientIp(request.headers))) {
    return NextResponse.json({ error: 'Too many events' }, { status: 429 });
  }

  //~ sendBeacon posts blob - content-type may be missing/odd, so parse text rather than trusting request.json()
  let body: { name?: unknown; props?: unknown; page?: unknown };
  try {
    body = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name : '';
  if (!(EVENT_NAMES as readonly string[]).includes(name)) {
    return NextResponse.json({ error: 'Unknown event' }, { status: 400 });
  }

  const props = sanitizeProps(body.props ?? {});
  if (!props) {
    return NextResponse.json({ error: 'Invalid props' }, { status: 400 });
  }

  const page = typeof body.page === 'string' && body.page.startsWith('/') && body.page.length <= 100 ? body.page : null;

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: 'Events service unavailable' }, { status: 503 });
  }

  const { error } = await supabase.from('events').insert({ name, props, page });
  if (error) {
    console.error('Error saving event:', error.message);
    return NextResponse.json({ error: 'Failed to save event' }, { status: 500 });
  }

  //~ 204: beacon callers never read body
  return new NextResponse(null, { status: 204 });
}
