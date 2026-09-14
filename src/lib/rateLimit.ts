//* lightweight per-instance ip rate limiter shared by write apis (remarks, feedback) - zero-cost abuse dampener
//^ (state is per serverless instance so it's nt hard guarantee, but it stops casual spam scripts)

export function createRateLimiter(maxWrites: number, windowMs: number) {
  const writeLog = new Map<string, number[]>();

  return function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const recent = (writeLog.get(ip) ?? []).filter(t => now - t < windowMs);
    if (recent.length >= maxWrites) {
      writeLog.set(ip, recent);
      return true;
    }
    recent.push(now);
    writeLog.set(ip, recent);
    //~ evict stale entries so map never grows unbounded
    if (writeLog.size > 1000) {
      for (const [key, times] of writeLog) {
        if (times.every(t => now - t >= windowMs)) writeLog.delete(key);
      }
    }
    return false;
  };
}

//& vercel sets x-forwarded-for to real client ip (first entry)
export function clientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
}
