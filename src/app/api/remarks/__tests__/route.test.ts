import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

//& validation tests fr the remarks api - no supabase env needed since every
//& asserted path exits before the db call (validation order: shape > length > location > db)

//~ unique ip per test so the per-ip rate limiter never cross-contaminates cases
const postRequest = (body: string, ip: string) =>
  new NextRequest('http://localhost/api/remarks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body,
  });

describe('GET /api/remarks', () => {
  it('returns 400 when locationId is missing', async () => {
    const res = await GET(new NextRequest('http://localhost/api/remarks'));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/remarks validation', () => {
  it('returns 400 for invalid json', async () => {
    const res = await POST(postRequest('not-json', '10.0.0.1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when locationId is missing', async () => {
    const res = await POST(postRequest(JSON.stringify({ content: 'hello' }), '10.0.0.2'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when content exceeds 280 characters', async () => {
    const res = await POST(
      postRequest(JSON.stringify({ locationId: 'sheets-abc123', content: 'x'.repeat(281) }), '10.0.0.3')
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown location id', async () => {
    const res = await POST(
      postRequest(JSON.stringify({ locationId: 'not-a-real-location', content: 'hello' }), '10.0.0.4')
    );
    expect(res.status).toBe(404);
  });
});

describe('POST /api/remarks rate limiting', () => {
  it('returns 429 after 5 writes within a minute from the same ip', async () => {
    const ip = '10.0.0.99';
    //~ first 5 attempts pass the limiter (they fail later validation, which still counts as writes)
    for (let i = 0; i < 5; i++) {
      const res = await POST(postRequest(JSON.stringify({}), ip));
      expect(res.status).toBe(400);
    }
    const res = await POST(postRequest(JSON.stringify({}), ip));
    expect(res.status).toBe(429);
  });
});
