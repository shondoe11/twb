import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

//* validation tests fr feedback api - no supabase env needed since every asserted path exits bef db call (order: rate limit > json > honeypot > category > message > contact > db)

//& unique ip per test so per-ip rate limiter never cross-contaminates cases
const postRequest = (body: string, ip: string) =>
  new NextRequest('http://localhost/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body,
  });

describe('POST /api/feedback validation', () => {
  it('returns 400 for invalid json', async () => {
    const res = await POST(postRequest('not-json', '10.1.0.1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 for an unknown category', async () => {
    const res = await POST(postRequest(JSON.stringify({ category: 'spam', message: 'hi' }), '10.1.0.2'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when message is missing or blank', async () => {
    const res = await POST(postRequest(JSON.stringify({ category: 'bug', message: '   ' }), '10.1.0.3'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when message exceeds 1000 characters', async () => {
    const res = await POST(
      postRequest(JSON.stringify({ category: 'bug', message: 'x'.repeat(1001) }), '10.1.0.4')
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 when contact exceeds 200 characters', async () => {
    const res = await POST(
      postRequest(JSON.stringify({ category: 'bug', message: 'hi', contact: 'x'.repeat(201) }), '10.1.0.5')
    );
    expect(res.status).toBe(400);
  });

  it('silently accepts honeypot submissions without touching the db', async () => {
    //~ deliberately invalid payload otherwise - proves honeypot short-circuits bef validation
    const res = await POST(postRequest(JSON.stringify({ website: 'http://spam.example' }), '10.1.0.6'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe('POST /api/feedback rate limiting', () => {
  it('returns 429 after 3 submissions within a minute from the same ip', async () => {
    const ip = '10.1.0.99';
    for (let i = 0; i < 3; i++) {
      const res = await POST(postRequest(JSON.stringify({}), ip));
      expect(res.status).toBe(400);
    }
    const res = await POST(postRequest(JSON.stringify({}), ip));
    expect(res.status).toBe(429);
  });
});
