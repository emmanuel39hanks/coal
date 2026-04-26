/**
 * In-process nonce store for SIWE wallet auth.
 *
 * FOR DEV / HACKATHON USE ONLY — serverless functions share no memory,
 * so in a multi-instance production deploy you need Redis (Upstash) or
 * a DB table. We gate this behind a check so prod deploys warn loudly.
 */

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const store = new Map<string, number>();

function sweep() {
    const cutoff = Date.now() - TTL_MS;
    for (const [nonce, ts] of store) {
        if (ts < cutoff) store.delete(nonce);
    }
}

export function mintNonce(): string {
    sweep();
    // 32 hex chars — SIWE requires alphanumeric, >= 8 chars.
    const nonce = [...crypto.getRandomValues(new Uint8Array(16))]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    store.set(nonce, Date.now());
    if (process.env.NODE_ENV === 'production') {
        console.warn('[coal-mini-app] Using in-memory nonce store in production — swap for Redis before scaling.');
    }
    return nonce;
}

export function consumeNonce(nonce: string): boolean {
    sweep();
    const ts = store.get(nonce);
    if (!ts) return false;
    if (Date.now() - ts > TTL_MS) {
        store.delete(nonce);
        return false;
    }
    store.delete(nonce); // one-time use
    return true;
}
