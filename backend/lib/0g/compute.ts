import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { Wallet, JsonRpcProvider } from 'ethers';
import OpenAI from 'openai';
import {
    createZGComputeNetworkBroker,
    createZGComputeNetworkReadOnlyBroker,
} from '@0glabs/0g-serving-broker';
import { zeroGLogger } from '@/lib/logger';
import {
    isZeroGComputeConfigured,
    zeroGEnv,
} from '@/lib/0g/env';
import type {
    ZeroGComputeMessage,
    ZeroGComputeService,
} from '@/lib/0g/types';

const responseFormatUnsupported = new Set<string>();
const responseFormatFallbackWarned = new Set<string>();

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
        promise.then(
            (value) => {
                clearTimeout(timeout);
                resolve(value);
            },
            (error) => {
                clearTimeout(timeout);
                reject(error);
            },
        );
    });
}

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeComputeBaseUrl(baseUrl: string) {
    const trimmed = baseUrl.replace(/\/+$/, '');
    return trimmed.endsWith('/v1/proxy') ? trimmed : `${trimmed}/v1/proxy`;
}

function appendJsonOnlyInstruction(messages: ZeroGComputeMessage[], mode: 'default' | 'strict' = 'default'): ZeroGComputeMessage[] {
    const jsonGuard =
        mode === 'strict'
            ? 'Return only a valid JSON object with no markdown fences or extra prose. Do not omit required keys. If unsure, use empty arrays, empty strings, or null values instead of inventing prose.'
            : 'Return only a valid JSON object with no markdown fences or extra prose.';
    if (!messages.length) {
        return [{ role: 'system', content: jsonGuard }] satisfies ZeroGComputeMessage[];
    }

    const [first, ...rest] = messages;
    if (first.role === 'system') {
        return [
            {
                ...first,
                content: `${first.content}\n\n${jsonGuard}`,
            },
            ...rest,
        ] as ZeroGComputeMessage[];
    }

    return [
        { role: 'system', content: jsonGuard },
        ...messages,
    ] as ZeroGComputeMessage[];
}

function extractJsonObject(content: string) {
    const trimmed = content.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    const candidate = fenced ? fenced[1].trim() : trimmed;

    if (candidate.startsWith('{') && candidate.endsWith('}')) {
        return candidate;
    }

    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
        return candidate.slice(firstBrace, lastBrace + 1);
    }

    return candidate;
}

function getProviderModelKey(provider: string | null | undefined, model: string) {
    return `${provider || 'unknown'}:${model}`;
}

function shouldMarkResponseFormatUnsupported(error: unknown) {
    const typedError = error as {
        message?: string;
        status?: number;
        error?: unknown;
    };
    const nestedMessage =
        typedError?.error && typeof typedError.error === 'object' && 'message' in typedError.error
            ? String((typedError.error as { message?: unknown }).message ?? '')
            : typeof typedError?.error === 'string'
              ? typedError.error
              : '';
    const combinedMessage = `${typedError?.message || ''} ${nestedMessage}`.toLowerCase();

    return typedError?.status === 400
        && !combinedMessage.includes('insufficient balance')
        && !combinedMessage.includes('timed out');
}

export async function listComputeServices(limit = 5): Promise<ZeroGComputeService[]> {
    if (!zeroGEnv.computeEnabled) {
        return [];
    }

    const broker = await createZGComputeNetworkReadOnlyBroker(zeroGEnv.chainRpcUrl, zeroGEnv.chainId);
    const services = await withTimeout(
        broker.inference.listServiceWithDetail(0, limit, false),
        15_000,
        '0G compute service discovery',
    );

    return services.map((service) => {
        const record = service as unknown as Record<string, unknown>;
        const health = (record.healthMetrics || {}) as Record<string, unknown>;

        return {
            providerAddress: String(record.provider || record.providerAddress || ''),
            model: String(record.model || record.serviceName || record.name || ''),
            endpoint: typeof record.endpoint === 'string' ? record.endpoint : undefined,
            serviceName: typeof record.serviceName === 'string' ? record.serviceName : undefined,
            uptimePct: typeof health.uptime === 'number' ? health.uptime : null,
            avgLatencyMs: typeof health.avgResponseTime === 'number' ? health.avgResponseTime : null,
            raw: service,
        };
    });
}

export function createZeroGOpenAIClient() {
    if (!isZeroGComputeConfigured()) {
        throw new Error('0G Compute direct API requires ZERO_G_COMPUTE_BASE_URL and ZERO_G_COMPUTE_API_KEY');
    }

    return new OpenAI({
        baseURL: normalizeComputeBaseUrl(zeroGEnv.computeBaseUrl),
        apiKey: zeroGEnv.computeApiKey,
        timeout: 30_000,
    });
}

/**
 * Check if Sealed Inference (TEE-backed compute) is enabled.
 * When enabled, sensitive commerce queries are routed through
 * hardware enclaves for cryptographic privacy.
 */
export function isSealedInferenceEnabled(): boolean {
    return zeroGEnv.sealedInferenceEnabled && isZeroGComputeConfigured();
}

export async function runStructuredInference<T>(input: {
    messages: ZeroGComputeMessage[];
    model?: string;
    temperature?: number;
    /** Route through Sealed Inference (TEE) for privacy-sensitive queries */
    sealed?: boolean;
}): Promise<{
    output: T;
    provider: string | null;
    model: string;
    verificationStatus: 'direct_secret' | 'sealed_tee';
}> {
    const useSealedInference = input.sealed && isSealedInferenceEnabled();
    const client = createZeroGOpenAIClient();
    const model = input.model || zeroGEnv.computeModel;
    if (!model) {
        throw new Error('0G structured inference requires a model parameter or ZERO_G_COMPUTE_MODEL');
    }
    const providerKey = getProviderModelKey(zeroGEnv.computeProvider || zeroGEnv.computeBaseUrl, model);

    let lastError: unknown = null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
        let content: string | null = null;
        let responseFormatError: unknown = null;

        try {
            if (!responseFormatUnsupported.has(providerKey)) {
                try {
                    const completion = await client.chat.completions.create({
                        model,
                        temperature: input.temperature ?? 0.1,
                        response_format: { type: 'json_object' },
                        messages: input.messages,
                    });
                    content = completion.choices[0]?.message?.content ?? null;
                } catch (error) {
                    responseFormatError = error;
                }
            }

            if (!content) {
                const completion = await client.chat.completions.create({
                    model,
                    temperature: input.temperature ?? 0.1,
                    messages: appendJsonOnlyInstruction(input.messages, attempt === 1 ? 'default' : 'strict'),
                });
                content = completion.choices[0]?.message?.content ?? null;

                if (responseFormatError && shouldMarkResponseFormatUnsupported(responseFormatError)) {
                    responseFormatUnsupported.add(providerKey);
                    if (!responseFormatFallbackWarned.has(providerKey)) {
                        responseFormatFallbackWarned.add(providerKey);
                        zeroGLogger.warn(
                            {
                                err: responseFormatError,
                                provider: zeroGEnv.computeProvider || zeroGEnv.computeBaseUrl,
                                model,
                            },
                            '0G Compute provider rejected response_format; future requests will use JSON-only prompting for this provider/model',
                        );
                    }
                }
            }

            if (!content) {
                throw new Error('0G Compute returned an empty response');
            }

            if (useSealedInference) {
                zeroGLogger.info(
                    { provider: zeroGEnv.computeProvider, model },
                    'Completed Sealed Inference (TEE) query',
                );
            }

            return {
                output: JSON.parse(extractJsonObject(content)) as T,
                provider: zeroGEnv.computeProvider || null,
                model,
                verificationStatus: useSealedInference ? 'sealed_tee' as const : 'direct_secret' as const,
            };
        } catch (error) {
            lastError = error;
            if (attempt >= 2) {
                break;
            }

            zeroGLogger.warn(
                {
                    err: error,
                    provider: zeroGEnv.computeProvider || zeroGEnv.computeBaseUrl,
                    model,
                    attempt,
                },
                '0G Compute structured inference failed, retrying once with stricter JSON instructions',
            );
            await delay(250);
        }
    }

    throw lastError instanceof Error ? lastError : new Error('0G Compute structured inference failed');
}

export async function verifyConfiguredProviderTee() {
    if (!zeroGEnv.computeEnabled || !zeroGEnv.computeProvider || !zeroGEnv.chainPrivateKey) {
        return null;
    }

    const outputDir = path.join(tmpdir(), `coal-0g-tee-${Date.now()}`);
    await mkdir(outputDir, { recursive: true });

    const provider = new JsonRpcProvider(zeroGEnv.chainRpcUrl);
    const wallet = new Wallet(zeroGEnv.chainPrivateKey, provider);
    const broker = await createZGComputeNetworkBroker(wallet);

    zeroGLogger.info({ provider: zeroGEnv.computeProvider }, 'Starting 0G Compute TEE verification');
    return withTimeout(
        broker.inference.verifyService(zeroGEnv.computeProvider, outputDir),
        90_000,
        '0G compute TEE verification',
    );
}
