import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkRateLimit } from '@/lib/rate-limit';

// Build a limiter config that matches the shape expected by checkRateLimit,
// with no Upstash (upstash: null) so the in-memory fallback is always used.
function makeTestLimiter(requests: number, windowMs: number) {
  return { requests, windowMs, upstash: null };
}

describe('checkRateLimit (in-memory fallback)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows a first request and returns limited: false', async () => {
    const limiter = makeTestLimiter(5, 60_000);
    const result = await checkRateLimit(limiter, `test-ip-allow-${Date.now()}`);
    expect(result.limited).toBe(false);
  });

  it('includes X-RateLimit-Limit and X-RateLimit-Remaining headers', async () => {
    const limiter = makeTestLimiter(5, 60_000);
    const result = await checkRateLimit(limiter, `test-ip-headers-${Date.now()}`);
    expect(result.headers['X-RateLimit-Limit']).toBe('5');
    expect(result.headers['X-RateLimit-Remaining']).toBeDefined();
  });

  it('decrements remaining count on each request', async () => {
    const limiter = makeTestLimiter(3, 60_000);
    const id = `test-ip-decrement-${Math.random()}`;

    const r1 = await checkRateLimit(limiter, id);
    expect(r1.headers['X-RateLimit-Remaining']).toBe('2');

    const r2 = await checkRateLimit(limiter, id);
    expect(r2.headers['X-RateLimit-Remaining']).toBe('1');

    const r3 = await checkRateLimit(limiter, id);
    expect(r3.headers['X-RateLimit-Remaining']).toBe('0');
  });

  it('blocks a request once the limit is exceeded', async () => {
    const limiter = makeTestLimiter(2, 60_000);
    const id = `test-ip-block-${Math.random()}`;

    await checkRateLimit(limiter, id); // 1st
    await checkRateLimit(limiter, id); // 2nd — exhausts limit

    const blocked = await checkRateLimit(limiter, id); // 3rd — should be limited
    expect(blocked.limited).toBe(true);
    expect(blocked.headers['X-RateLimit-Remaining']).toBe('0');
  });

  it('resets the window after the window duration elapses', async () => {
    const windowMs = 10_000; // 10 seconds
    const limiter = makeTestLimiter(2, windowMs);
    const id = `test-ip-reset-${Math.random()}`;

    await checkRateLimit(limiter, id); // 1st
    await checkRateLimit(limiter, id); // 2nd — exhausts limit

    const blocked = await checkRateLimit(limiter, id);
    expect(blocked.limited).toBe(true);

    // Advance time past the window
    vi.advanceTimersByTime(windowMs + 1);

    const allowed = await checkRateLimit(limiter, id);
    expect(allowed.limited).toBe(false);
  });

  it('allows requests from different identifiers independently', async () => {
    const limiter = makeTestLimiter(1, 60_000);

    const r1 = await checkRateLimit(limiter, `ip-independent-A-${Math.random()}`);
    const r2 = await checkRateLimit(limiter, `ip-independent-B-${Math.random()}`);

    expect(r1.limited).toBe(false);
    expect(r2.limited).toBe(false);
  });

  it('blocks the second request from the same identifier with limit 1', async () => {
    const limiter = makeTestLimiter(1, 60_000);
    const id = `test-ip-limit1-${Math.random()}`;

    const r1 = await checkRateLimit(limiter, id);
    expect(r1.limited).toBe(false);

    const r2 = await checkRateLimit(limiter, id);
    expect(r2.limited).toBe(true);
  });
});
