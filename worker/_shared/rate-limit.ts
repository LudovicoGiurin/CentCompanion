type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Simple in-memory rate limiter (per isolate). */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; remaining: number } {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, remaining: 0 };
  }
  return { ok: true, remaining: Math.max(0, limit - bucket.count) };
}

/** Prune old buckets occasionally to avoid unbounded growth. */
export function pruneRateLimits() {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}
