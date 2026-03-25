import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

// ── In-memory fallback (used when Upstash is not configured) ─────────────────

interface WindowEntry {
    timestamps: number[];
}

const memoryStore = new Map<string, WindowEntry>();

function memoryRateLimit(
    key: string,
    maxRequests: number,
    windowMs: number
): { success: boolean; remaining: number } {
    const now = Date.now();
    const entry = memoryStore.get(key) ?? { timestamps: [] };

    // Slide the window
    entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);
    const remaining = maxRequests - entry.timestamps.length;

    if (remaining <= 0) {
        memoryStore.set(key, entry);
        return { success: false, remaining: 0 };
    }

    entry.timestamps.push(now);
    memoryStore.set(key, entry);
    return { success: true, remaining: remaining - 1 };
}

// Clean up stale keys every 5 minutes to prevent unbounded growth
setInterval(() => {
    const cutoff = Date.now() - 5 * 60 * 1000;
    for (const [key, entry] of memoryStore.entries()) {
        if (entry.timestamps.every(t => t < cutoff)) memoryStore.delete(key);
    }
}, 5 * 60 * 1000);

// ── Upstash Redis (production) ────────────────────────────────────────────────

const isUpstashConfigured = !!(
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
);

let redis: Redis | null = null;
if (isUpstashConfigured) {
    redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
}

function makeUpstashLimiter(
    requests: number,
    window: `${number} ${'s' | 'm' | 'h' | 'd'}`,
    prefix: string
): Ratelimit | null {
    if (!redis) return null;
    return new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(requests, window), prefix });
}

// ── Limiter config ────────────────────────────────────────────────────────────

interface LimiterConfig {
    requests: number;
    windowMs: number;
    upstash: Ratelimit | null;
}

function makeLimiter(
    requests: number,
    window: `${number} ${'s' | 'm' | 'h' | 'd'}`,
    prefix: string
): LimiterConfig {
    const windowMs = parseWindowMs(window);
    return {
        requests,
        windowMs,
        upstash: makeUpstashLimiter(requests, window, prefix),
    };
}

function parseWindowMs(window: string): number {
    const match = window.match(/^(\d+)\s*(s|m|h|d)$/);
    if (!match) return 60_000;
    const n = parseInt(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return n * multipliers[unit];
}

export const rateLimiters = {
    auth:     makeLimiter(5,  '1 m', 'rl:auth'),
    checkout: makeLimiter(10, '1 m', 'rl:checkout'),
    confirm:  makeLimiter(5,  '1 m', 'rl:confirm'),
    console:  makeLimiter(60, '1 m', 'rl:console'),
    public:   makeLimiter(30, '1 m', 'rl:public'),
    aiQuery:  makeLimiter(20, '1 m', 'rl:ai-query'),
};

export function getIP(request: Request): string {
    return (
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown'
    );
}

export async function checkRateLimit(
    limiter: LimiterConfig,
    identifier: string
): Promise<{ limited: boolean; headers: Record<string, string> }> {
    // Try Upstash first (production)
    if (limiter.upstash) {
        try {
            const { success, limit, remaining, reset } = await limiter.upstash.limit(identifier);
            return {
                limited: !success,
                headers: {
                    'X-RateLimit-Limit':     String(limit),
                    'X-RateLimit-Remaining': String(remaining),
                    'X-RateLimit-Reset':     String(reset),
                },
            };
        } catch (err) {
            logger.warn({ err }, 'Upstash rate-limit error — falling back to memory');
        }
    }

    // In-memory fallback (dev / no Redis)
    const { success, remaining } = memoryRateLimit(
        `${identifier}`,
        limiter.requests,
        limiter.windowMs
    );
    return {
        limited: !success,
        headers: {
            'X-RateLimit-Limit':     String(limiter.requests),
            'X-RateLimit-Remaining': String(remaining),
        },
    };
}
