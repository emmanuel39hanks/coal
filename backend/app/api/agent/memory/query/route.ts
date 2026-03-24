import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/api-auth';
import { errors, apiSuccess } from '@/lib/errors';
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit';
import { getMerchantMemorySource } from '@/lib/0g/merchant';
import { isZeroGComputeConfigured, zeroGEnv } from '@/lib/0g/env';
import { runStructuredInference } from '@/lib/0g/compute';
import { normalizeStructuredStringList } from '@/lib/0g/ai-commerce';
import { validateBody } from '@/lib/schemas';

const memoryQuerySchema = z.object({
    query: z.string().min(1).max(1500),
});

const stringArraySchema = z.preprocess(
    (value) => normalizeStructuredStringList(value),
    z.array(z.string()),
);

const memoryQueryResponseSchema = z.object({
    answer: z.string().min(1),
    citations: stringArraySchema,
    recommendedActions: stringArraySchema,
});

export async function POST(request: Request) {
    try {
        const keyRecord = await validateApiKey(request);
        if (!keyRecord) return errors.unauthorized('Invalid or missing API Key');

        const { limited } = await checkRateLimit(rateLimiters.checkout, keyRecord.id);
        if (limited) return errors.rateLimited();

        const body = await request.json().catch(() => ({}));
        const validated = validateBody(memoryQuerySchema, body);
        if (!validated.success) return validated.error;

        const merchantId = keyRecord.merchant.id;
        const merchantName = keyRecord.merchant.name || 'Merchant';

        const memorySource = await getMerchantMemorySource(merchantId);
        if (!memorySource?.snapshot) {
            return errors.notFound('Merchant memory');
        }

        const snapshot = memorySource.snapshot;
        const products = Array.isArray(snapshot.products) ? snapshot.products : [];
        const paywalls = Array.isArray(snapshot.paywalls) ? snapshot.paywalls : [];
        const team = Array.isArray(snapshot.team) ? snapshot.team : [];

        let response: {
            answer: string;
            citations: string[];
            recommendedActions: string[];
        };
        let computeJobId: string | null = null;

        if (isZeroGComputeConfigured()) {
            const computeJob = await prisma.computeJob.create({
                data: {
                    merchantId,
                    kind: 'memory_query',
                    provider: zeroGEnv.computeProvider || zeroGEnv.computeBaseUrl,
                    model: zeroGEnv.computeModel || 'configured-0g-model',
                    status: 'running',
                    metadata: { query: validated.data.query },
                    startedAt: new Date(),
                },
            });
            computeJobId = computeJob.id;

            try {
                const result = await runStructuredInference<{
                    answer: string;
                    citations: string[];
                    recommendedActions: string[];
                }>({
                    temperature: 0,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are Coal merchant memory. Answer only from the supplied merchant context and return compact JSON with answer, citations, and recommendedActions.',
                        },
                        {
                            role: 'user',
                            content: JSON.stringify({
                                query: validated.data.query,
                                merchantContext: {
                                    merchantId,
                                    merchantName,
                                    source: memorySource.source,
                                    snapshot,
                                },
                            }),
                        },
                    ],
                });

                response = memoryQueryResponseSchema.parse(result.output);

                await prisma.computeJob.update({
                    where: { id: computeJob.id },
                    data: {
                        status: 'completed',
                        verificationStatus: result.verificationStatus,
                        completedAt: new Date(),
                    },
                });
            } catch (error) {
                await prisma.computeJob.update({
                    where: { id: computeJob.id },
                    data: {
                        status: 'failed',
                        errorMessage: error instanceof Error ? error.message : '0G compute failed',
                        completedAt: new Date(),
                    },
                });

                response = {
                    answer: `${merchantName} currently has ${products.length} active products, ${paywalls.length} active paywalls, and ${team.length} team members. Use the citations to navigate the exact assets.`,
                    citations: [
                        ...products.slice(0, 3).map((product) => `product:${String((product as Record<string, unknown>).id ?? 'unknown')}`),
                        ...paywalls.slice(0, 3).map((paywall) => `paywall:${String((paywall as Record<string, unknown>).id ?? 'unknown')}`),
                    ],
                    recommendedActions: [
                        'Inspect the relevant paywall manifest',
                        'Create a checkout session if payment is required',
                        'Verify any finished checkout receipt before fulfillment',
                    ],
                };
            }
        } else {
            response = {
                answer: `${merchantName} currently has ${products.length} active products, ${paywalls.length} active paywalls, and ${team.length} team members. 0G Compute is not configured, so this answer is based on the latest ${memorySource.source === '0g_storage' ? '0G-backed' : 'local'} merchant snapshot.`,
                citations: [
                    ...products.slice(0, 3).map((product) => `product:${String((product as Record<string, unknown>).id ?? 'unknown')}`),
                    ...paywalls.slice(0, 3).map((paywall) => `paywall:${String((paywall as Record<string, unknown>).id ?? 'unknown')}`),
                ],
                recommendedActions: [
                    'Inspect the relevant paywall manifest',
                    'Create a checkout session if payment is required',
                    'Verify any finished checkout receipt before fulfillment',
                ],
            };
        }

        return apiSuccess({
            merchantId,
            query: validated.data.query,
            response,
            source: isZeroGComputeConfigured() ? '0g_compute_or_fallback' : 'merchant_snapshot',
            computeJobId,
            zeroG: {
                memorySource: memorySource.source,
                storageUri: memorySource.artifact?.storageUri ?? null,
                storageRoot: memorySource.artifact?.storageRoot ?? null,
                payloadHash: memorySource.artifact?.payloadHash ?? null,
            },
        });
    } catch {
        return errors.internal();
    }
}
