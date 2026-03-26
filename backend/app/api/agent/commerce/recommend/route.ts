import { z } from 'zod';
import { validateApiKey } from '@/lib/api-auth';
import { errors, apiSuccess } from '@/lib/errors';
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit';
import { validateBody } from '@/lib/schemas';
import {
    loadMerchantCommerceContext,
    normalizeStructuredStringList,
    runMerchantStructuredJob,
    sanitizeForAIPrompt,
} from '@/lib/0g/ai-commerce';

const recommendSchema = z.object({
    goal: z.string().min(1).max(1200),
});

function createRecommendResponseSchema(input: {
    products: Array<{ id: string; name: string }>;
    paywalls: Array<{ id: string; name: string }>;
}) {
    const defaultProduct = input.products[0] ?? null;
    const defaultPaywall = input.paywalls[0] ?? null;
    const productNames = new Map(input.products.map((product) => [product.id, product.name]));
    const paywallNames = new Map(input.paywalls.map((paywall) => [paywall.id, paywall.name]));

    return z.preprocess(
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

            const items = Array.isArray(record.items)
                ? record.items
                      .map((item) => {
                          if (!item || typeof item !== 'object') return null;
                          const itemRecord = item as Record<string, unknown>;
                          const id =
                              typeof itemRecord.id === 'string'
                                  ? itemRecord.id
                                  : typeof itemRecord.productId === 'string'
                                    ? itemRecord.productId
                                    : typeof itemRecord.paywallId === 'string'
                                      ? itemRecord.paywallId
                                      : null;
                          const rawType = typeof itemRecord.type === 'string' ? itemRecord.type : null;
                          const inferredType =
                              rawType === 'checkout'
                                  ? 'product'
                                  : rawType === 'product' || rawType === 'paywall'
                                    ? rawType
                                    : id && paywallNames.has(id)
                                      ? 'paywall'
                                      : id && productNames.has(id)
                                        ? 'product'
                                        : null;
                          const name =
                              typeof itemRecord.name === 'string' && itemRecord.name.trim()
                                  ? itemRecord.name
                                  : id && inferredType === 'paywall'
                                    ? paywallNames.get(id) ?? null
                                    : id && inferredType === 'product'
                                      ? productNames.get(id) ?? null
                                      : null;

                          if (!id || !name || (inferredType !== 'product' && inferredType !== 'paywall')) {
                              return null;
                          }

                          return {
                              id,
                              type: inferredType,
                              name,
                          };
                      })
                      .filter(Boolean)
                : [];

            const normalizedItems =
                items.length > 0
                    ? items
                    : recommendedSurface === 'paywall_manifest' && defaultPaywall
                      ? [
                            {
                                id: defaultPaywall.id,
                                type: 'paywall' as const,
                                name: defaultPaywall.name,
                            },
                        ]
                      : recommendedSurface === 'product_checkout' && defaultProduct
                        ? [
                            {
                                id: defaultProduct.id,
                                type: 'product' as const,
                                name: defaultProduct.name,
                            },
                        ]
                        : [];

            return {
                recommendedSurface,
                reason:
                    typeof record.reason === 'string'
                        ? record.reason
                        : typeof record.rationale === 'string'
                          ? record.rationale
                          : '',
                items: normalizedItems,
                citations: normalizeStructuredStringList(record.citations),
            };
        },
        z.object({
            recommendedSurface: z.enum(['product_checkout', 'paywall_manifest', 'manual_review']),
            reason: z.string().min(1),
            items: z.array(
                z.object({
                    id: z.string().min(1),
                    type: z.enum(['product', 'paywall']),
                    name: z.string().min(1),
                }),
            ),
            citations: z.array(z.string()),
        }),
    );
}

export async function POST(request: Request) {
    try {
        const keyRecord = await validateApiKey(request);
        if (!keyRecord) return errors.unauthorized('Invalid or missing API Key');

        const { limited } = await checkRateLimit(rateLimiters.checkout, keyRecord.id);
        if (limited) return errors.rateLimited();

        const body = await request.json().catch(() => ({}));
        const validated = validateBody(recommendSchema, body);
        if (!validated.success) return validated.error;

        const context = await loadMerchantCommerceContext(keyRecord.merchant.id, keyRecord.merchant.name || undefined);
        if (!context) return errors.notFound('Merchant memory');
        const recommendResponseSchema = createRecommendResponseSchema({
            products: context.products.map((product) => ({ id: product.id, name: product.name })),
            paywalls: context.paywalls.map((paywall) => ({ id: paywall.id, name: paywall.name })),
        });

        const result = await runMerchantStructuredJob<{
            recommendedSurface: 'product_checkout' | 'paywall_manifest' | 'manual_review';
            reason: string;
            items: Array<{
                id: string;
                type: 'product' | 'paywall';
                name: string;
            }>;
            citations: string[];
        }>({
            merchantId: context.merchantId,
            kind: 'commerce_recommend',
            systemPrompt:
                'Recommend the best Coal commerce surface for the merchant goal. Use only the supplied merchant context and return compact JSON with recommendedSurface, reason, items, and citations.',
            userPayload: {
                goal: sanitizeForAIPrompt(validated.data.goal),
                products: context.products,
                paywalls: context.paywalls,
            },
            fallback: () => {
                const wantsGatedAccess = /read|article|content|api|paywall|unlock|access/i.test(validated.data.goal);
                if (wantsGatedAccess && context.paywalls[0]) {
                    return {
                        recommendedSurface: 'paywall_manifest',
                        reason: `The goal sounds like gated access, so start with the ${context.paywalls[0].name} paywall manifest.`,
                        items: [
                            {
                                id: context.paywalls[0].id,
                                type: 'paywall',
                                name: context.paywalls[0].name,
                            },
                        ],
                        citations: [`paywall:${context.paywalls[0].id}`],
                    };
                }

                if (context.products[0]) {
                    return {
                        recommendedSurface: 'product_checkout',
                        reason: `The goal sounds like a purchase flow, so start with checkout for ${context.products[0].name}.`,
                        items: [
                            {
                                id: context.products[0].id,
                                type: 'product',
                                name: context.products[0].name,
                            },
                        ],
                        citations: [`product:${context.products[0].id}`],
                    };
                }

                return {
                    recommendedSurface: 'manual_review',
                    reason: 'No active products or paywalls are available to recommend automatically.',
                    items: [],
                    citations: [],
                };
            },
            responseSchema: recommendResponseSchema,
            temperature: 0,
        });

        return apiSuccess({
            merchantId: context.merchantId,
            goal: validated.data.goal,
            recommendation: result.output,
            source: result.source,
            computeJobId: result.computeJobId,
            zeroG: {
                memorySource: context.memorySource.source,
                storageUri: context.memorySource.artifact?.storageUri ?? null,
                storageRoot: context.memorySource.artifact?.storageRoot ?? null,
            },
        });
    } catch {
        return errors.internal();
    }
}
