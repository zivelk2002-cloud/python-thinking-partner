/**
 * Best-effort per-IP rate limiter, in memory.
 * On serverless (Vercel) each function instance has its own memory, so this is
 * approximate. If abuse happens, swap this for Upstash Redis (see README).
 */
export const RATE_LIMIT = { max: 20, windowMs: 10 * 60 * 1000 };

export interface RateLimiter {
  /** Returns true if the request is allowed (and records it). */
  hit(key: string, now?: number): boolean;
  /** Seconds until the oldest request leaves the window. */
  retryAfter(key: string, now?: number): number;
}

export function createRateLimiter(max = RATE_LIMIT.max, windowMs = RATE_LIMIT.windowMs): RateLimiter {
  const hits = new Map<string, number[]>();
  let lastSweep = 0;

  function sweep(now: number) {
    if (now - lastSweep < windowMs) return;
    lastSweep = now;
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= windowMs)) hits.delete(key);
    }
  }

  return {
    hit(key, now = Date.now()) {
      sweep(now);
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
    retryAfter(key, now = Date.now()) {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length < max) return 0;
      return Math.ceil((recent[0] + windowMs - now) / 1000);
    },
  };
}

/** One shared limiter for all AI routes in this instance. */
export const aiLimiter = createRateLimiter();

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}
