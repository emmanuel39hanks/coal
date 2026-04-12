/**
 * POST /api/agent/publish-catalog
 *
 * Catalog indexing as a service. Merchants whose products live outside Coal's
 * console (Shopify, Sanity, Postgres, wherever) POST their catalog here with
 * their Coal API key. Coal upserts the products into prisma.product with
 * source="external", then runs the existing publishMerchantProfileBundle()
 * pipeline which snapshots the profile to 0G Storage (Log layer) and mirrors
 * it to 0G KV for live agent discovery.
 *
 * This turns any merchant site into an agent-discoverable commerce endpoint
 * with no migration and no console use.
 */

import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/api-auth';
import { publishCatalogSchema, validateBody } from '@/lib/schemas';
import { errors, apiSuccess } from '@/lib/errors';
import { rateLimiters, checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { syncMerchantZeroGArtifacts } from '@/lib/0g/merchant';
import { buildZeroGStreamId } from '@/lib/0g/catalog';
import { NextResponse } from 'next/server';

// Hard limit mirrors the Zod schema max. Defensive — we do not want a merchant
// who bypassed client-side validation to hit Prisma with a 10k-product array.
const MAX_PRODUCTS_PER_PUBLISH = 500;

export async function POST(request: Request) {
    try {
        // ── Auth ────────────────────────────────────────────────────────────
        const keyRecord = await validateApiKey(request);
        if (!keyRecord) return errors.unauthorized('Invalid or missing API Key');

        const merchantId = keyRecord.merchant.id;

        // ── Rate limit (per merchant) ───────────────────────────────────────
        const { limited, headers: rlHeaders } = await checkRateLimit(
            rateLimiters.publish,
            `publish:${merchantId}`,
        );
        if (limited) {
            return NextResponse.json(
                {
                    error: {
                        code: 'RATE_LIMITED',
                        message:
                            'Too many catalog publishes. Please wait before publishing again.',
                    },
                },
                { status: 429, headers: rlHeaders },
            );
        }

        // ── Body validation ─────────────────────────────────────────────────
        const body = await request.json().catch(() => ({}));
        const validated = validateBody(publishCatalogSchema, body);
        if (!validated.success) return validated.error;

        const { products, mode } = validated.data;

        // Defense-in-depth cap (Zod schema already enforces this, but never
        // trust a single layer).
        if (products.length > MAX_PRODUCTS_PER_PUBLISH) {
            return errors.validation({
                products: [`Maximum ${MAX_PRODUCTS_PER_PUBLISH} products per publish`],
            });
        }

        // Guard against duplicate externalIds in the same payload — they would
        // silently collapse during upsert and mislead the merchant.
        const externalIds = products.map((p) => p.externalId);
        const duplicates = externalIds.filter(
            (id, i) => externalIds.indexOf(id) !== i,
        );
        if (duplicates.length > 0) {
            return errors.validation({
                products: [
                    `Duplicate externalId values in payload: ${Array.from(new Set(duplicates)).join(', ')}`,
                ],
            });
        }

        // ── Upsert products ─────────────────────────────────────────────────
        // Uses (merchantId, externalId) unique key for idempotency. All writes
        // run inside a single Prisma interactive transaction so partial failures
        // do not leave the catalog half-updated.
        const upsertResult = await prisma.$transaction(async (tx) => {
            const upserted = [];

            for (const p of products) {
                const result = await tx.product.upsert({
                    where: {
                        merchantId_externalId: {
                            merchantId,
                            externalId: p.externalId,
                        },
                    },
                    create: {
                        merchantId,
                        source: 'external',
                        externalId: p.externalId,
                        name: p.name,
                        description: p.description ?? null,
                        price: p.price,
                        image: p.image || null,
                        images: p.images ?? [],
                        sku: p.sku || null,
                        tags: p.tags ?? [],
                        billingType: p.billingType ?? 'one_time',
                        billingInterval:
                            p.billingType === 'subscription'
                                ? p.billingInterval ?? null
                                : null,
                        billingIntervalCount:
                            p.billingType === 'subscription'
                                ? p.billingIntervalCount ?? 1
                                : 1,
                        active: true,
                        status: 'active',
                    },
                    update: {
                        name: p.name,
                        description: p.description ?? null,
                        price: p.price,
                        image: p.image || null,
                        images: p.images ?? [],
                        sku: p.sku || null,
                        tags: p.tags ?? [],
                        billingType: p.billingType ?? 'one_time',
                        billingInterval:
                            p.billingType === 'subscription'
                                ? p.billingInterval ?? null
                                : null,
                        billingIntervalCount:
                            p.billingType === 'subscription'
                                ? p.billingIntervalCount ?? 1
                                : 1,
                        active: true,
                        status: 'active',
                        source: 'external',
                    },
                });
                upserted.push(result);
            }

            // Replace mode: deactivate any external products NOT in this payload.
            // Console-sourced products are left alone — replace only affects the
            // external catalog slice so merchants using both modes are safe.
            let deactivated = 0;
            if (mode === 'replace' && externalIds.length > 0) {
                const result = await tx.product.updateMany({
                    where: {
                        merchantId,
                        source: 'external',
                        externalId: { notIn: externalIds },
                        active: true,
                    },
                    data: { active: false, status: 'archived' },
                });
                deactivated = result.count;
            }

            return { upserted, deactivated };
        });

        // ── Publish merchant profile + memory to 0G ─────────────────────────
        // syncMerchantZeroGArtifacts() publishes BOTH:
        //   1. Profile bundle → 0G Storage (Log) + KV mirror
        //      (products, paywalls, endpoints, capabilities)
        //   2. Memory snapshot → 0G Storage (encrypted AES-256-GCM)
        //      (full product descriptions, team info, settings — used by
        //      0G Compute for memory queries and policy evaluation)
        //
        // Without the memory sync, agents using 0G Compute (query_merchant_memory)
        // see stale product data even though the profile is fresh. Both must stay
        // in sync after every catalog publish.
        const syncResult = await syncMerchantZeroGArtifacts(merchantId).catch(
            (err) => {
                logger.warn(
                    { err, merchantId },
                    'publish-catalog: 0G artifact sync failed (non-blocking)',
                );
                return null;
            },
        );
        const published = syncResult?.profile ?? null;

        logger.info(
            {
                merchantId,
                productCount: upsertResult.upserted.length,
                deactivated: upsertResult.deactivated,
                mode,
                zeroGPublished: Boolean(published && !published.skipped),
                zeroGSkipped: Boolean(published && published.skipped),
            },
            'Catalog published',
        );

        // ── Response ────────────────────────────────────────────────────────
        const zeroG = published
            ? {
                  published: !published.skipped,
                  skipped: published.skipped,
                  storageUri: published.artifact?.storageUri ?? null,
                  storageRoot: published.artifact?.storageRoot ?? null,
                  storageTxHash: published.artifact?.storageTxHash ?? null,
                  payloadHash: published.artifact?.payloadHash ?? null,
                  kv: {
                      streamId: buildZeroGStreamId('merchant', merchantId),
                      key: 'merchant:profile:latest',
                  },
              }
            : {
                  published: false,
                  skipped: false,
                  storageUri: null,
                  storageRoot: null,
                  storageTxHash: null,
                  payloadHash: null,
                  kv: null,
              };

        return apiSuccess(
            {
                merchantId,
                productCount: upsertResult.upserted.length,
                deactivated: upsertResult.deactivated,
                mode,
                products: upsertResult.upserted.map((p) => ({
                    id: p.id,
                    externalId: p.externalId,
                    name: p.name,
                    price: p.price.toString(),
                    image: p.image,
                    active: p.active,
                })),
                zeroG,
            },
            200,
        );
    } catch (error) {
        logger.error({ err: error }, 'publish-catalog endpoint error');
        return errors.internal();
    }
}
