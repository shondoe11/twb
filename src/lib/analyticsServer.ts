import { createHash } from 'crypto';

//* server-only helpers fr /api/events: derive non-reversible identity layer frm request & throw raw inputs away
//& nothing here is imported by client code (node crypto)

export type Device = 'mobile' | 'tablet' | 'desktop' | 'unknown';

//& daily-rotating visitor hash (plausible's approach): same person+device = same hash within utc day, different hash tmr, ip never stored
//~ salt = secret + date so every serverless instance agrees w/o shared state. EVENTS_SALT is optional - falls back to supabase key (server only)
export function visitorHash(ip: string, userAgent: string, now = new Date()): string | null {
  const secret = process.env.EVENTS_SALT || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!secret || !ip || ip === 'unknown') return null;
  const day = now.toISOString().slice(0, 10);
  return createHash('sha256').update(`${secret}|${day}|${ip}|${userAgent}`).digest('hex').slice(0, 16);
}

//& coarse bucket only - ua string itself is discarded. tablet checked first: ipad & android-without-mobile would otherwise fall through
export function deviceFromUserAgent(userAgent: string | null): Device {
  if (!userAgent) return 'unknown';
  if (/iPad|Tablet|PlayBook|Silk|Kindle/i.test(userAgent) || (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent))) return 'tablet';
  if (/Mobi|iPhone|iPod|Android|Windows Phone|webOS|BlackBerry/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

//& vercel injects geo headers on every req - country: iso-2, city: url-encoded (etc 'Ang%20Mo%20Kio')
export function geoFromHeaders(headers: Headers): { country: string | null; city: string | null } {
  const rawCountry = headers.get('x-vercel-ip-country');
  const rawCity = headers.get('x-vercel-ip-city');
  const country = rawCountry && /^[A-Z]{2}$/.test(rawCountry) ? rawCountry : null;
  let city: string | null = null;
  if (rawCity) {
    try {
      city = decodeURIComponent(rawCity).slice(0, 64) || null;
    } catch {
      city = null;
    }
  }
  return { country, city };
}

//& session ids minted client-side as uuids - accept only that shape so junk cannot be smuggled into column
export function sanitizeSessionId(value: unknown): string | null {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : null;
}
