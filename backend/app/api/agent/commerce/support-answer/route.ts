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

const supportAnswerSchema = z.object({
    question: z.string().min(1).max(1500),
});

const stringArraySchema = z.preprocess(
    (value) => normalizeStructuredStringList(value),
    z.array(z.string()),
);

const supportAnswerResponseSchema = z.object({
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
        const validated = validateBody(supportAnswerSchema, body);
        if (!validated.success) return validated.error;

        const context = await loadMerchantCommerceContext(keyRecord.merchant.id, keyRecord.merchant.name || undefined);
        if (!context) return errors.notFound('Merchant memory');

        const result = await runMerchantStructuredJob<{
            answer: string;
            citations: string[];
            recommendedActions: string[];
        }>({
            merchantId: context.merchantId,
            kind: 'support_answer',
            systemPrompt:
                'You are Coal support orchestration for a merchant. Answer using only the provided merchant context. Return compact JSON with answer, citations, and recommendedActions.',
            userPayload: {
                question: sanitizeForAIPrompt(validated.data.question),
                merchant: context.merchant,
                settings: context.settings,
                products: context.products,
                paywalls: context.paywalls,
                team: context.team,
            },
            fallback: () => ({
                answer: `${context.merchantName} currently has ${context.products.length} active products, ${context.paywalls.length} active paywalls, and ${context.team.length} team members. Webhooks are ${context.settings.webhookUrl ? 'configured' : 'not configured'}, and onboarding is ${context.settings.onboardingComplete ? 'complete' : 'still in progress'}.`,
                citations: [
                    'merchant:settings',
                    ...context.products.slice(0, 2).map((product) => `product:${product.id}`),
                    ...context.paywalls.slice(0, 2).map((paywall) => `paywall:${paywall.id}`),
                ],
                recommendedActions: [
                    context.settings.webhookUrl ? 'Verify webhook delivery if support issue is event-related' : 'Configure a webhook if realtime updates are required',
                    'Inspect the relevant paywall manifest before granting access',
                    'Verify the receipt for any completed checkout before fulfillment',
                ],
            }),
            responseSchema: supportAnswerResponseSchema,
            temperature: 0,
        });

        return apiSuccess({
            merchantId: context.merchantId,
            question: validated.data.question,
            response: result.output,
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
