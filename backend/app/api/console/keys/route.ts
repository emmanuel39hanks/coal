import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser, hasWriteAccess } from '@/lib/privy';
import crypto from 'crypto';
import { createKeySchema, validateBody } from '@/lib/schemas';
import { errors, apiSuccess } from '@/lib/errors';
import { rateLimiters, checkRateLimit } from '@/lib/rate-limit';
import { parsePaginationParams, paginatedMeta } from '@/lib/pagination';

export async function GET(request: Request) {
    try {
        const user = await getAuthUser(request);
        if (!user) return errors.unauthorized();

        const url = new URL(request.url);
        const pagination = parsePaginationParams(url);
        const where = { merchantId: user.id, revokedAt: null };

        const [keys, total] = await Promise.all([
            prisma.apiKey.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: pagination.skip,
                take: pagination.take,
            }),
            prisma.apiKey.count({ where }),
        ]);

        return apiSuccess({
            keys: keys.map(k => ({
                id:        k.id,
                name:      k.name,
                prefix:    k.keyPrefix,
                lastUsed:  k.lastUsed,
                createdAt: k.createdAt,
            })),
            pagination: paginatedMeta(total, pagination),
        });
    } catch {
        return errors.internal();
    }
}

export async function POST(request: Request) {
    try {
        const user = await getAuthUser(request);
        if (!user) return errors.unauthorized();
        if (!hasWriteAccess(user)) return errors.forbidden();

        const { limited } = await checkRateLimit(rateLimiters.console, user.id);
        if (limited) return errors.rateLimited();

        const body = await request.json().catch(() => ({}));
        const validated = validateBody(createKeySchema, body);
        if (!validated.success) return validated.error;

        const { name } = validated.data;
        const secretKey = `coal_live_${crypto.randomBytes(24).toString('hex')}`;
        const hashed = crypto.createHash('sha256').update(secretKey).digest('hex');

        const key = await prisma.apiKey.create({
            data: {
                merchantId:  user.id,
                name:        name || 'Secret Key',
                keyPrefix:   'coal_live_',
                secretHash:  hashed,
            }
        });

        return apiSuccess({
            key: {
                id:        key.id,
                name:      key.name,
                secret:    secretKey,
                createdAt: key.createdAt,
            }
        }, 201);
    } catch {
        return errors.internal();
    }
}
