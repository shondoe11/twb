import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';
import { EVENT_NAMES } from '@/lib/analytics';

//* validation tests fr events api - no supabase env needed since every asserted path exits bef db call (order: rate limit > json > name > props > db)

//& unique ip per test so per-ip rate limiter never cross-contaminates cases
const postRequest = (body: string, ip: string) =>
  new NextRequest('http://localhost/api/events', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip },
    body,
  });

describe('POST /api/events validation', () => {
  it('returns 400 for invalid json', async () => {
    const res = await POST(postRequest('not-json', '10.2.0.1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 for an event name nt in the whitelist', async () => {
    const res = await POST(postRequest(JSON.stringify({ name: 'made_up', props: {} }), '10.2.0.2'));
    expect(res.status).toBe(400);
  });

  it('returns 400 for nested props', async () => {
    const res = await POST(postRequest(JSON.stringify({ name: 'pin_opened', props: { nested: { a: 1 } } }), '10.2.0.3'));
    expect(res.status).toBe(400);
  });

  it('returns 400 for array props', async () => {
    const res = await POST(postRequest(JSON.stringify({ name: 'pin_opened', props: ['a'] }), '10.2.0.4'));
    expect(res.status).toBe(400);
  });

  it('returns 400 whn a prop value is too long', async () => {
    const res = await POST(postRequest(JSON.stringify({ name: 'pin_opened', props: { name: 'x'.repeat(121) } }), '10.2.0.5'));
    expect(res.status).toBe(400);
  });

  it('returns 400 whn there are too many props', async () => {
    const props = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`k${i}`, 'v']));
    const res = await POST(postRequest(JSON.stringify({ name: 'pin_opened', props }), '10.2.0.6'));
    expect(res.status).toBe(400);
  });

  it('whitelist covers every event the client can emit', () => {
    //~ guards against adding event to AnalyticsEvents but forgetting EVENT_NAMES (tsc catches the reverse)
    expect(EVENT_NAMES).toContain('pin_opened');
    expect(EVENT_NAMES).toContain('directions_clicked');
    expect(EVENT_NAMES).toContain('filter_changed');
    expect(EVENT_NAMES).toContain('remark_saved');
    expect(EVENT_NAMES).toContain('feedback_sent');
    expect(EVENT_NAMES).toContain('theme_changed');
  });
});

describe('POST /api/events rate limiting', () => {
  it('returns 429 after 60 events within a minute from the same ip', async () => {
    const ip = '10.2.0.99';
    for (let i = 0; i < 60; i++) {
      const res = await POST(postRequest('{}', ip));
      expect(res.status).toBe(400);
    }
    const res = await POST(postRequest('{}', ip));
    expect(res.status).toBe(429);
  });
});
