import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { publicClient } from '@/lib/chain';
import { logger } from '@/lib/logger';

/**
 * GET /api/health
 *
 * Public health check — no auth required.
 * Returns 200 always (monitoring tools check HTTP status, not body).
 * Status is "ok" when all checks pass, "degraded" when one or more fail.
 */
export async function GET() {
    const start = Date.now();

    const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};

    // DB check
    const dbStart = Date.now();
    try {
        await prisma.$queryRaw`SELECT 1`;
        checks.db = { ok: true, latencyMs: Date.now() - dbStart };
    } catch (e) {
        checks.db = { ok: false, error: 'Database unreachable' };
    }

    // RPC check
    const rpcStart = Date.now();
    try {
        await publicClient.getBlockNumber();
        checks.rpc = { ok: true, latencyMs: Date.now() - rpcStart };
    } catch (e) {
        checks.rpc = { ok: false, error: 'RPC unreachable' };
    }

    const allOk = Object.values(checks).every(c => c.ok);
    const totalMs = Date.now() - start;

    logger.info({ responseTimeMs: totalMs, db: checks.db?.ok, rpc: checks.rpc?.ok }, 'Health check');

    const body = {
        status: allOk ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        responseTimeMs: totalMs,
        checks,
    };

    return NextResponse.json(body, {
        status: 200,
        headers: { 'x-response-time': `${totalMs}ms` }
    });
}
