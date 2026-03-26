import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { getMerchantMemorySource } from '@/lib/0g/merchant';
import { isZeroGComputeConfigured, zeroGEnv } from '@/lib/0g/env';
import { runStructuredInference } from '@/lib/0g/compute';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            },
        );
    });
}

/**
 * Sanitize user-supplied text before embedding in AI prompts.
 * Prevents prompt injection by stripping instruction-like patterns
 * and bounding the input in clear delimiters.
 */
export function sanitizeForAIPrompt(input: string): string {
    return input
        .replace(/```/g, '')              // Strip code fences that could close prompt blocks
        .replace(/\n{3,}/g, '\n\n')       // Collapse excessive newlines
        .slice(0, 2000)                    // Hard length cap
        .trim();
}

export function normalizeStructuredStringList(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.map((item) => {
        if (typeof item === 'string') {
            return item;
        }

        if (item && typeof item === 'object') {
            const record = item as Record<string, unknown>;
            if (typeof record.field === 'string') {
                const renderedValue =
                    typeof record.value === 'string'
                        ? record.value
                        : JSON.stringify(record.value ?? null);
                return `${record.field}:${renderedValue}`;
            }

            if (typeof record.type === 'string' && typeof record.id === 'string') {
                return `${record.type}:${record.id}`;
            }

            if (typeof record.id === 'string') {
                return record.id;
            }

            if (typeof record.name === 'string') {
                return record.name;
            }
        }

        return JSON.stringify(item);
    });
}

export async function loadMerchantCommerceContext(merchantId: string, fallbackName?: string) {
    const memorySource = await getMerchantMemorySource(merchantId);
    if (!memorySource?.snapshot) {
        return null;
    }

    const snapshot = memorySource.snapshot;
    const merchantRecord =
        snapshot.merchant && typeof snapshot.merchant === 'object'
            ? (snapshot.merchant as Record<string, unknown>)
            : {};
    const settingsRecord =
        snapshot.settings && typeof snapshot.settings === 'object'
            ? (snapshot.settings as Record<string, unknown>)
            : {};

    const products = Array.isArray(snapshot.products)
        ? snapshot.products.map((product) => {
              const record = product as Record<string, unknown>;
              return {
                  id: String(record.id ?? ''),
                  name: String(record.name ?? ''),
                  description: typeof record.description === 'string' ? record.description : null,
                  price: String(record.price ?? '0'),
                  sku: typeof record.sku === 'string' ? record.sku : null,
              };
          })
        : [];

    const paywalls = Array.isArray(snapshot.paywalls)
        ? snapshot.paywalls.map((paywall) => {
              const record = paywall as Record<string, unknown>;
              return {
                  id: String(record.id ?? ''),
                  name: String(record.name ?? ''),
                  description: typeof record.description === 'string' ? record.description : null,
                  price: String(record.price ?? '0'),
                  currency: String(record.currency ?? 'USDC'),
                  contentType: String(record.contentType ?? 'api'),
                  pricingModel: String(record.pricingModel ?? 'one_time'),
              };
          })
        : [];

    const team = Array.isArray(snapshot.team)
        ? snapshot.team.map((member) => {
              const record = member as Record<string, unknown>;
              const user = record.user && typeof record.user === 'object' ? (record.user as Record<string, unknown>) : {};
              return {
                  id: String(record.id ?? ''),
                  role: String(record.role ?? 'member'),
                  name: typeof user.name === 'string' ? user.name : null,
                  email: typeof user.email === 'string' ? user.email : null,
              };
          })
        : [];

    return {
        merchantId,
        merchantName:
            (typeof merchantRecord.name === 'string' && merchantRecord.name) ||
            fallbackName ||
            'Merchant',
        merchant: {
            name: typeof merchantRecord.name === 'string' ? merchantRecord.name : null,
            email: typeof merchantRecord.email === 'string' ? merchantRecord.email : null,
            payoutAddress: typeof merchantRecord.payoutAddress === 'string' ? merchantRecord.payoutAddress : null,
            webhookUrl: typeof merchantRecord.webhookUrl === 'string' ? merchantRecord.webhookUrl : null,
            onboardingComplete: Boolean(merchantRecord.onboardingComplete),
        },
        settings: {
            webhookUrl: typeof settingsRecord.webhookUrl === 'string' ? settingsRecord.webhookUrl : null,
            payoutAddress: typeof settingsRecord.payoutAddress === 'string' ? settingsRecord.payoutAddress : null,
            onboardingComplete: Boolean(settingsRecord.onboardingComplete),
        },
        products,
        paywalls,
        team,
        snapshot,
        memorySource,
    };
}

export async function runMerchantStructuredJob<T>(input: {
    merchantId: string;
    kind: string;
    systemPrompt: string;
    userPayload: Record<string, unknown>;
    fallback: () => T;
    responseSchema?: z.ZodType<T>;
    model?: string;
    temperature?: number;
    /** Use Sealed Inference (TEE) for privacy-sensitive queries */
    sealed?: boolean;
}) {
    let computeJobId: string | null = null;

    if (isZeroGComputeConfigured()) {
        const computeJob = await prisma.computeJob.create({
            data: {
                merchantId: input.merchantId,
                kind: input.kind,
                provider: zeroGEnv.computeProvider || zeroGEnv.computeBaseUrl,
                model: input.model || zeroGEnv.computeModel || 'configured-0g-model',
                status: 'running',
                metadata: input.userPayload as Prisma.InputJsonValue,
                startedAt: new Date(),
            },
        });
        computeJobId = computeJob.id;

        try {
            const result = await withTimeout(
                runStructuredInference<T>({
                    model: input.model,
                    temperature: input.temperature ?? 0,
                    sealed: input.sealed,
                    messages: [
                        {
                            role: 'system',
                            content: input.systemPrompt,
                        },
                        {
                            role: 'user',
                            content: JSON.stringify(input.userPayload),
                        },
                    ],
                }),
                20_000,
                `0G compute ${input.kind}`,
            );
            const validatedOutput = input.responseSchema
                ? input.responseSchema.parse(result.output)
                : result.output;

            await prisma.computeJob.update({
                where: { id: computeJob.id },
                data: {
                    status: 'completed',
                    verificationStatus: result.verificationStatus,
                    completedAt: new Date(),
                },
            });

            return {
                output: validatedOutput,
                computeJobId,
                source: '0g_compute' as const,
                provider: result.provider,
                model: result.model,
            };
        } catch (error) {
            await prisma.computeJob.update({
                where: { id: computeJob.id },
                data: {
                    status: 'failed',
                    errorMessage: error instanceof Error ? error.message : '0G compute failed',
                    completedAt: new Date(),
                },
            });
        }
    }

    return {
        output: input.fallback(),
        computeJobId,
        source: 'fallback' as const,
        provider: zeroGEnv.computeProvider || null,
        model: input.model || zeroGEnv.computeModel || null,
    };
}
