import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { visitorHash, deviceFromUserAgent, geoFromHeaders, sanitizeSessionId } from '../analyticsServer';

//* the id layer must be non-reversible & stable within a day - these pin down that contract

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const ANDROID_PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

describe('visitorHash', () => {
  const saved = process.env.EVENTS_SALT;
  beforeEach(() => { process.env.EVENTS_SALT = 'test-secret'; });
  afterEach(() => { process.env.EVENTS_SALT = saved; });

  it('is stable fr the same ip+ua within a utc day', () => {
    const a = visitorHash('1.2.3.4', MAC, new Date('2026-09-26T01:00:00Z'));
    const b = visitorHash('1.2.3.4', MAC, new Date('2026-09-26T23:00:00Z'));
    expect(a).toBe(b);
    expect(a).toHaveLength(16);
  });

  it('rotates across days so visitors cannot be linked day to day', () => {
    const today = visitorHash('1.2.3.4', MAC, new Date('2026-09-26T12:00:00Z'));
    const tomorrow = visitorHash('1.2.3.4', MAC, new Date('2026-09-27T12:00:00Z'));
    expect(today).not.toBe(tomorrow);
  });

  it('differs fr different ips & does nt contain the ip', () => {
    const a = visitorHash('1.2.3.4', MAC);
    const b = visitorHash('5.6.7.8', MAC);
    expect(a).not.toBe(b);
    expect(a).not.toContain('1.2.3.4');
  });

  it('returns null whn ip is unknown or no secret is configured', () => {
    expect(visitorHash('unknown', MAC)).toBeNull();
    delete process.env.EVENTS_SALT;
    const savedKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    const savedAnon = process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;
    expect(visitorHash('1.2.3.4', MAC)).toBeNull();
    if (savedKey) process.env.SUPABASE_PUBLISHABLE_KEY = savedKey;
    if (savedAnon) process.env.SUPABASE_ANON_KEY = savedAnon;
  });
});

describe('deviceFromUserAgent', () => {
  it('buckets phones as mobile', () => {
    expect(deviceFromUserAgent(IPHONE)).toBe('mobile');
    expect(deviceFromUserAgent(ANDROID_PHONE)).toBe('mobile');
  });

  it('buckets ipad & android-without-mobile as tablet', () => {
    expect(deviceFromUserAgent(IPAD)).toBe('tablet');
    expect(deviceFromUserAgent(ANDROID_TABLET)).toBe('tablet');
  });

  it('buckets everything else as desktop, missing ua as unknown', () => {
    expect(deviceFromUserAgent(MAC)).toBe('desktop');
    expect(deviceFromUserAgent(null)).toBe('unknown');
    expect(deviceFromUserAgent('')).toBe('unknown');
  });
});

describe('geoFromHeaders', () => {
  it('reads vercel geo headers & url-decodes the city', () => {
    const headers = new Headers({ 'x-vercel-ip-country': 'SG', 'x-vercel-ip-city': 'Ang%20Mo%20Kio' });
    expect(geoFromHeaders(headers)).toEqual({ country: 'SG', city: 'Ang Mo Kio' });
  });

  it('rejects malformed country codes & tolerates missing headers', () => {
    expect(geoFromHeaders(new Headers({ 'x-vercel-ip-country': 'Singapore' }))).toEqual({ country: null, city: null });
    expect(geoFromHeaders(new Headers())).toEqual({ country: null, city: null });
  });
});

describe('sanitizeSessionId', () => {
  it('accepts a uuid & rejects anything else', () => {
    expect(sanitizeSessionId('3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe('3f2504e0-4f89-11d3-9a0c-0305e82c3301');
    expect(sanitizeSessionId('not-a-uuid')).toBeNull();
    expect(sanitizeSessionId(123)).toBeNull();
    expect(sanitizeSessionId(undefined)).toBeNull();
  });
});
