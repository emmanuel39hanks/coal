import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/api-auth';
import { errors, apiSuccess } from '@/lib/errors';
import { validateBody } from '@/lib/schemas';
import { isZeroGComputeConfigured, zeroGEnv } from '@/lib/0g/env';
import { runStructuredInference } from '@/lib/0g/compute';
import { getMerchantMemorySource } from '@/lib/0g/merchant';
import { sanitizeForAIPrompt } from '@/lib/0g/ai-commerce';

const commerceRouteSchema = z.object({
    goal: z.string().min(1).max(1000),
});

const routeResponseSchema = z.preprocess(
    (value) => {
        if (!value || typeof value !== 'object') return value;

        const record = value as Record<string, unknown>;
        const rawSurface =
            typeof record.recommendedSurface === 'string'
                ? record.recommendedSurface
                : typeof record.route === 'string'
                  ? record.route
                  : null;
        const recommendedSurface =
            rawSurface === 'paywall'
                ? 'paywall_manifest'
                : rawSurface === 'product' || rawSurface === 'checkout'
                  ? 'product_checkout'
                  : rawSurface === 'manual'
                    ? 'manual_review'
                    : rawSurface;

        return {
            recommendedSurface,
            targetId:
                typeof record.targetId === 'string'
                    ? record.targetId
                    : typeof record.paywall_id === 'string'
                      ? record.paywall_id
                      : typeof record.product_id === 'string'
                        ? record.product_id
                        : null,
            reason:
                typeof record.reason === 'string'
                    ? record.reason
                    : typeof record.rationale === 'string'
                      ? record.rationale
                      : '',
        };
    },
    z.object({
        recommendedSurface: z.enum(['product_checkout', 'paywall_manifest', 'manual_review']),
        targetId: z.string().nullable(),
        reason: z.string().min(1),
    }),
);

export async function POST(request: Request) {
    try {
        const keyRecord = await validateApiKey(request);
        if (!keyRecord) return errors.unauthorized('Invalid or missing API Key');

        const body = await request.json().catch(() => ({}));
        const validated = validateBody(commerceRouteSchema, body);
        if (!validated.success) return validated.error;

        const merchantId = keyRecord.merchant.id;
        const memorySource = await getMerchantMemorySource(merchantId);
        const snapshot = memorySource?.snapshot;
        const products = Array.isArray(snapshot?.products)
            ? snapshot.products.map((product) => ({
                  id: String((product as Record<string, unknown>).id ?? ''),
                  name: String((product as Record<string, unknown>).name ?? ''),
                  description:
                      typeof (product as Record<string, unknown>).description === 'string'
                          ? ((product as Record<string, unknown>).description as string)
                          : null,
                  price: String((product as Record<string, unknown>).price ?? '0'),
              }))
            : await prisma.product.findMany({
                  where: { merchantId, active: true },
                  orderBy: { createdAt: 'desc' },
                  select: { id: true, name: true, description: true, price: true },
              }).then((rows) =>
                  rows.map((product) => ({
                      id: product.id,
                      name: product.name,
                      description: product.description,
                      price: product.price.toString(),
                  })),
              );
        const paywalls = Array.isArray(snapshot?.paywalls)
            ? snapshot.paywalls.map((paywall) => ({
                  id: String((paywall as Record<string, unknown>).id ?? ''),
                  name: String((paywall as Record<string, unknown>).name ?? ''),
                  description:
                      typeof (paywall as Record<string, unknown>).description === 'string'
                          ? ((paywall as Record<string, unknown>).description as string)
                          : null,
                  price: String((paywall as Record<string, unknown>).price ?? '0'),
                  currency: String((paywall as Record<string, unknown>).currency ?? 'USDC'),
              }))
            : await prisma.paywall.findMany({
                  where: { merchantId, active: true },
                  orderBy: { createdAt: 'desc' },
                  select: { id: true, name: true, description: true, price: true, currency: true },
              }).then((rows) =>
                  rows.map((paywall) => ({
                      id: paywall.id,
                      name: paywall.name,
                      description: paywall.description,
                      price: paywall.price.toString(),
                      currency: paywall.currency,
                  })),
              );

        let route: {
            recommendedSurface: 'product_checkout' | 'paywall_manifest' | 'manual_review';
            targetId: string | null;
            reason: string;
            nextEndpoint: string | null;
        } | null = null;

        if (isZeroGComputeConfigured()) {
            try {
                const result = await runStructuredInference<{
                    recommendedSurface: 'product_checkout' | 'paywall_manifest' | 'manual_review';
                    targetId: string | null;
                    reason: string;
                }>({
                    temperature: 0,
                    messages: [
                        {
                            role: 'system',
                            content: 'Route commerce requests to either a product checkout, a paywall manifest, or manual review. Return compact JSON.',
                        },
                        {
                            role: 'user',
                            content: JSON.stringify({
                                goal: sanitizeForAIPrompt(validated.data.goal),
                                products,
                                paywalls,
                            }),
                        },
                    ],
                });
                const normalizedRoute = routeResponseSchema.parse(result.output);

                route = {
                    ...normalizedRoute,
                    nextEndpoint:
                        normalizedRoute.recommendedSurface === 'paywall_manifest' && normalizedRoute.targetId
                            ? `/api/agent/paywalls/${normalizedRoute.targetId}/manifest`
                            : normalizedRoute.recommendedSurface === 'product_checkout'
                              ? '/api/agent/checkout'
                              : null,
                };
            } catch {}
        }

        if (!route && (/read|api|access|content|article|paywall/i).test(validated.data.goal) && paywalls[0]) {
            route = {
                recommendedSurface: 'paywall_manifest',
                targetId: paywalls[0].id,
                reason: `The request sounds like gated access, so the best first step is the ${paywalls[0].name} paywall manifest.`,
                nextEndpoint: `/api/agent/paywalls/${paywalls[0].id}/manifest`,
            };
        } else if (!route && products[0]) {
            route = {
                recommendedSurface: 'product_checkout',
                targetId: products[0].id,
                reason: `The request sounds like a purchase flow, so start with a checkout for ${products[0].name}.`,
                nextEndpoint: '/api/agent/checkout',
            };
        } else if (!route) {
            route = {
                recommendedSurface: 'manual_review',
                targetId: null,
                reason: 'No active products or paywalls are available to route automatically.',
                nextEndpoint: null,
            };
        }

        return apiSuccess({
            merchantId,
            goal: validated.data.goal,
            route,
            computeConfigured: isZeroGComputeConfigured(),
            computeProvider: zeroGEnv.computeProvider || null,
            zeroG: {
                memorySource: memorySource?.source ?? 'local_snapshot',
                storageUri: memorySource?.artifact?.storageUri ?? null,
                storageRoot: memorySource?.artifact?.storageRoot ?? null,
            },
        });
    } catch {
        return errors.internal();
    }
}
