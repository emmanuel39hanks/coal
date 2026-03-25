import { z } from 'zod';
import { validateApiKey } from '@/lib/api-auth';
import { errors, apiSuccess } from '@/lib/errors';
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit';
import { validateBody } from '@/lib/schemas';
import {
    loadMerchantCommerceContext,
    normalizeStructuredStringList,
    runMerchantStructuredJob,
} from '@/lib/0g/ai-commerce';

const policyEvalSchema = z.object({
    scenario: z.string().min(1).max(2000),
});

const stringArraySchema = z.preprocess(
    (value) => normalizeStructuredStringList(value),
    z.array(z.string()),
);

const policyEvalResponseSchema = z.preprocess(
    (value) => {
        if (!value || typeof value !== 'object') return value;

        const record = value as Record<string, unknown>;
        const rawDecision =
            typeof record.decision === 'string'
                ? record.decision
                : typeof record.outcome === 'string'
                  ? record.outcome
                  : null;
        const decision =
            rawDecision === 'approve'
                ? 'allow'
                : rawDecision === 'reject'
                  ? 'deny'
                  : rawDecision === 'manual_review'
                    ? 'review'
                    : rawDecision;

        return {
            decision,
            rationale:
                typeof record.rationale === 'string'
                    ? record.rationale
                    : typeof record.reason === 'string'
                      ? record.reason
                      : '',
            citations: record.citations,
            nextActions: record.nextActions,
        };
    },
    z.object({
        decision: z.enum(['allow', 'deny', 'review']),
        rationale: z.string().min(1),
        citations: stringArraySchema,
        nextActions: stringArraySchema,
    }),
);

export async function POST(request: Request) {
    try {
        const keyRecord = await validateApiKey(request);
        if (!keyRecord) return errors.unauthorized('Invalid or missing API Key');

        const { limited } = await checkRateLimit(rateLimiters.aiQuery, keyRecord.id);
        if (limited) return errors.rateLimited();

        const body = await request.json().catch(() => ({}));
        const validated = validateBody(policyEvalSchema, body);
        if (!validated.success) return validated.error;

        const context = await loadMerchantCommerceContext(keyRecord.merchant.id, keyRecord.merchant.name || undefined);
        if (!context) return errors.notFound('Merchant memory');

        const result = await runMerchantStructuredJob<{
            decision: 'allow' | 'deny' | 'review';
            rationale: string;
            citations: string[];
            nextActions: string[];
        }>({
            merchantId: context.merchantId,
            kind: 'policy_eval',
            // Policy evaluation involves sensitive merchant and customer data
            sealed: true,
            systemPrompt:
                'You evaluate commerce policy decisions for Coal merchants. Use only the supplied merchant context and return compact JSON with decision, rationale, citations, and nextActions.',
            userPayload: {
                scenario: validated.data.scenario,
                merchant: context.merchant,
                settings: context.settings,
                products: context.products,
                paywalls: context.paywalls,
                team: context.team,
            },
            fallback: () => {
                const lowerScenario = validated.data.scenario.toLowerCase();
                const decision =
                    lowerScenario.includes('refund') || lowerScenario.includes('chargeback')
                        ? 'review'
                        : lowerScenario.includes('webhook') && !context.settings.webhookUrl
                          ? 'deny'
                          : 'allow';

                return {
                    decision,
                    rationale:
                        decision === 'review'
                            ? 'This scenario touches refunds, disputes, or reversals, so it should be reviewed by the merchant instead of auto-approved.'
                            : decision === 'deny'
                              ? 'The requested workflow depends on a missing webhook configuration.'
                              : 'Nothing in the current merchant settings blocks this scenario.',
                    citations: ['merchant:settings'],
                    nextActions: [
                        decision === 'review' ? 'Escalate to the merchant owner or admin' : 'Proceed with the documented Coal payment flow',
                        context.settings.webhookUrl ? 'Keep receipt verification in the fulfillment path' : 'Configure a webhook before automating downstream actions',
                    ],
                };
            },
            responseSchema: policyEvalResponseSchema,
            temperature: 0,
        });

        return apiSuccess({
            merchantId: context.merchantId,
            scenario: validated.data.scenario,
            evaluation: result.output,
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
