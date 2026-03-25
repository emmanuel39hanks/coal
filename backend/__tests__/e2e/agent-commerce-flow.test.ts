/**
 * E2E flow test: AI Commerce (memory query + policy evaluation)
 *
 * Exercises the agent commerce APIs end-to-end: memory query routing through
 * sealed inference, policy eval with sealed inference for sensitive data,
 * fallback when 0G compute is unavailable, and compute job lifecycle.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock external dependencies ──────────────────────────────────────────────

const mockApiKeyFindFirst = vi.fn();
const mockApiKeyUpdate = vi.fn();
const mockComputeJobCreate = vi.fn();
const mockComputeJobUpdate = vi.fn();
const mockStoredArtifactFindFirst = vi.fn();
const mockUserFindUnique = vi.fn();

vi.mock('@/lib/prisma', () => ({
    prisma: {
        apiKey: {
            findFirst: (...args: unknown[]) => mockApiKeyFindFirst(...args),
            update: (...args: unknown[]) => mockApiKeyUpdate(...args),
        },
        computeJob: {
            create: (...args: unknown[]) => mockComputeJobCreate(...args),
            update: (...args: unknown[]) => mockComputeJobUpdate(...args),
        },
        storedArtifact: {
            findFirst: (...args: unknown[]) => mockStoredArtifactFindFirst(...args),
        },
        user: {
            findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
        },
    },
}));

vi.mock('@/lib/logger', () => ({
    zeroGLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/rate-limit', () => ({
    rateLimiters: { checkout: { requests: 50, windowMs: 60_000, upstash: null } },
    checkRateLimit: vi.fn().mockResolvedValue({ limited: false, headers: {} }),
    getIP: vi.fn().mockReturnValue('127.0.0.1'),
}));

vi.mock('@/lib/chain', () => ({
    CHAIN_ID: 8453,
    getSettlementToken: () => ({
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
    }),
}));

const mockRunStructuredInference = vi.fn();
const mockIsSealedInferenceEnabled = vi.fn();
let mockIsComputeConfigured = true;

vi.mock('@/lib/0g/compute', () => ({
    runStructuredInference: (...args: unknown[]) => mockRunStructuredInference(...args),
    isSealedInferenceEnabled: () => mockIsSealedInferenceEnabled(),
    listComputeServices: vi.fn().mockResolvedValue([]),
    createZeroGOpenAIClient: vi.fn(),
}));

vi.mock('@/lib/0g/env', () => ({
    zeroGEnv: {
        enabled: true,
        computeEnabled: true,
        computeBaseUrl: 'https://compute.0g.test',
        computeApiKey: 'test_compute_key',
        computeModel: 'test-model-v1',
        computeProvider: '0g-test-provider',
        sealedInferenceEnabled: true,
        chainRpcUrl: 'https://rpc.0g.test',
        chainId: 16661,
    },
    isZeroGEnabled: () => true,
    isZeroGComputeConfigured: () => mockIsComputeConfigured,
}));

const mockGetLatestArtifact = vi.fn();
vi.mock('@/lib/0g/catalog', () => ({
    getLatestArtifact: (...args: unknown[]) => mockGetLatestArtifact(...args),
    buildZeroGStreamId: vi.fn(() => '0xstream'),
}));

const mockLoadJsonArtifact = vi.fn();
vi.mock('@/lib/0g/storage', () => ({
    loadJsonArtifact: (...args: unknown[]) => mockLoadJsonArtifact(...args),
    publishJson: vi.fn(),
    publishEncryptedJson: vi.fn(),
    upsertMutableJson: vi.fn(),
    sha256Hex: vi.fn(() => '0xhash'),
    stableJsonStringify: vi.fn((v: unknown) => JSON.stringify(v)),
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MERCHANT_ID = 'merchant_test_ai';
const API_KEY_HASH = '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8'; // sha256 of "password"
const COMPUTE_JOB_ID = 'cj_test_123';

const API_KEY_RECORD = {
    id: 'key_test_1',
    secretHash: API_KEY_HASH,
    revokedAt: null,
    merchant: {
        id: MERCHANT_ID,
        name: 'AI Test Merchant',
        email: 'ai@test.com',
        payoutAddress: '0xmerchant_ai_payout',
    },
};

const MEMORY_SNAPSHOT = {
    version: 'coal.merchant_memory.v1',
    merchantId: MERCHANT_ID,
    capturedAt: '2026-03-25T10:00:00.000Z',
    merchant: {
        name: 'AI Test Merchant',
        email: 'ai@test.com',
        payoutAddress: '0xmerchant_ai_payout',
        webhookUrl: 'https://webhook.ai.test/hook',
        onboardingComplete: true,
    },
    products: [
        { id: 'prod_1', name: 'Pro Plan', description: 'Professional tier', price: '29.99', sku: 'PRO' },
        { id: 'prod_2', name: 'Basic Plan', description: 'Starter tier', price: '9.99', sku: 'BASIC' },
    ],
    paywalls: [
        { id: 'pw_1', name: 'Premium API', description: 'API access', price: '49.99', currency: 'USDC', contentType: 'api', pricingModel: 'one_time' },
    ],
    team: [
        { id: 'tm_1', role: 'owner', user: { id: MERCHANT_ID, name: 'AI Test Merchant', email: 'ai@test.com' } },
    ],
    settings: {
        webhookUrl: 'https://webhook.ai.test/hook',
        payoutAddress: '0xmerchant_ai_payout',
        onboardingComplete: true,
    },
};

function setupApiKeyMock() {
    mockApiKeyFindFirst.mockResolvedValue(API_KEY_RECORD);
    mockApiKeyUpdate.mockResolvedValue({});
}

function setupMemorySourceMocks() {
    mockGetLatestArtifact.mockResolvedValue({
        storageRoot: '0xmemory_root',
        storageUri: '0g://log/0xmemory_root',
        payloadHash: '0xmemory_hash',
        storageTxHash: '0xmemory_tx',
        kind: 'merchant_memory_snapshot',
        metadata: { logicalPayloadHash: '0xlogical' },
    });
    mockLoadJsonArtifact.mockResolvedValue({
        payload: MEMORY_SNAPSHOT,
        download: { byteSize: 1024, durationMs: 50 },
    });
}

function setupComputeJobMocks() {
    mockComputeJobCreate.mockResolvedValue({ id: COMPUTE_JOB_ID });
    mockComputeJobUpdate.mockResolvedValue({});
}

// ─── Test Suites ─────────────────────────────────────────────────────────────

let POST_memoryQuery: typeof import('@/app/api/agent/memory/query/route').POST;
let POST_policyEval: typeof import('@/app/api/agent/commerce/policy-eval/route').POST;

beforeAll(async () => {
    ({ POST: POST_memoryQuery } = await import('@/app/api/agent/memory/query/route'));
    ({ POST: POST_policyEval } = await import('@/app/api/agent/commerce/policy-eval/route'));
});

describe('Agent Commerce E2E Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockIsComputeConfigured = true;
        mockIsSealedInferenceEnabled.mockReturnValue(true);
    });

    // ─── Memory Query ────────────────────────────────────────────────────────

    describe('Memory query routes through sealed inference when enabled', () => {
        it('returns structured answer from 0G compute with sealed inference', async () => {
            setupApiKeyMock();
            setupMemorySourceMocks();
            setupComputeJobMocks();

            mockRunStructuredInference.mockResolvedValue({
                output: {
                    answer: 'AI Test Merchant has 2 products and 1 paywall.',
                    citations: ['product:prod_1', 'product:prod_2', 'paywall:pw_1'],
                    recommendedActions: ['Inspect the Premium API paywall manifest'],
                },
                provider: '0g-test-provider',
                model: 'test-model-v1',
                verificationStatus: 'sealed_tee',
            });

            const request = new Request('http://localhost/api/agent/memory/query', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': 'password',
                },
                body: JSON.stringify({ query: 'What products does this merchant have?' }),
            });
            const response = await POST_memoryQuery(request);

            expect(response.status).toBe(200);
            const body = await response.json();

            expect(body.response.answer).toContain('2 products');
            expect(body.response.citations).toContain('product:prod_1');
            expect(body.computeJobId).toBe(COMPUTE_JOB_ID);
            expect(body.zeroG.sealedInference).toBe(true);
            expect(body.zeroG.memorySource).toBe('0g_storage');
        });

        it('passes sealed:true to runStructuredInference for sensitive data', async () => {
            setupApiKeyMock();
            setupMemorySourceMocks();
            setupComputeJobMocks();

            mockRunStructuredInference.mockResolvedValue({
                output: {
                    answer: 'Result',
                    citations: [],
                    recommendedActions: [],
                },
                provider: '0g-test-provider',
                model: 'test-model-v1',
                verificationStatus: 'sealed_tee',
            });

            const request = new Request('http://localhost/api/agent/memory/query', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': 'password',
                },
                body: JSON.stringify({ query: 'Show me merchant details' }),
            });
            await POST_memoryQuery(request);

            expect(mockRunStructuredInference).toHaveBeenCalledWith(
                expect.objectContaining({ sealed: true }),
            );
        });

        it('creates and updates compute job in DB during inference', async () => {
            setupApiKeyMock();
            setupMemorySourceMocks();
            setupComputeJobMocks();

            mockRunStructuredInference.mockResolvedValue({
                output: {
                    answer: 'Result',
                    citations: [],
                    recommendedActions: [],
                },
                provider: '0g-test-provider',
                model: 'test-model-v1',
                verificationStatus: 'sealed_tee',
            });

            const request = new Request('http://localhost/api/agent/memory/query', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': 'password',
                },
                body: JSON.stringify({ query: 'Test query' }),
            });
            await POST_memoryQuery(request);

            // Job created with status 'running'
            expect(mockComputeJobCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        merchantId: MERCHANT_ID,
                        kind: 'memory_query',
                        status: 'running',
                    }),
                }),
            );

            // Job updated to 'completed' with sealed_tee verification
            expect(mockComputeJobUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: 'completed',
                        verificationStatus: 'sealed_tee',
                    }),
                }),
            );
        });

        it('falls back to snapshot-based answer when 0G compute fails', async () => {
            setupApiKeyMock();
            setupMemorySourceMocks();
            setupComputeJobMocks();

            mockRunStructuredInference.mockRejectedValue(new Error('0G Compute timeout'));

            const request = new Request('http://localhost/api/agent/memory/query', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': 'password',
                },
                body: JSON.stringify({ query: 'What products exist?' }),
            });
            const response = await POST_memoryQuery(request);

            expect(response.status).toBe(200);
            const body = await response.json();

            // Fallback answer based on snapshot counts
            expect(body.response.answer).toContain('2 active products');
            expect(body.response.answer).toContain('1 active paywall');

            // Compute job should be marked failed
            expect(mockComputeJobUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: 'failed',
                        errorMessage: '0G Compute timeout',
                    }),
                }),
            );
        });

        it('returns snapshot-based answer when 0G compute is not configured', async () => {
            mockIsComputeConfigured = false;
            setupApiKeyMock();
            setupMemorySourceMocks();

            const request = new Request('http://localhost/api/agent/memory/query', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': 'password',
                },
                body: JSON.stringify({ query: 'Merchant info' }),
            });
            const response = await POST_memoryQuery(request);

            expect(response.status).toBe(200);
            const body = await response.json();

            expect(body.response.answer).toContain('0G Compute is not configured');
            expect(body.source).toBe('merchant_snapshot');
            expect(body.computeJobId).toBeNull();
            expect(mockRunStructuredInference).not.toHaveBeenCalled();
        });
    });

    // ─── Memory Query error scenarios ────────────────────────────────────────

    describe('Memory query error handling', () => {
        it('returns 401 when no API key is provided', async () => {
            mockApiKeyFindFirst.mockResolvedValue(null);

            const request = new Request('http://localhost/api/agent/memory/query', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ query: 'test' }),
            });
            const response = await POST_memoryQuery(request);
            expect(response.status).toBe(401);
        });

        it('returns validation error for empty query', async () => {
            setupApiKeyMock();

            const request = new Request('http://localhost/api/agent/memory/query', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': 'password',
                },
                body: JSON.stringify({ query: '' }),
            });
            const response = await POST_memoryQuery(request);
            expect(response.status).toBe(400);
        });

        it('returns 404 when merchant memory is not available', async () => {
            setupApiKeyMock();
            mockGetLatestArtifact.mockResolvedValue(null);
            mockUserFindUnique.mockResolvedValue(null);

            const request = new Request('http://localhost/api/agent/memory/query', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': 'password',
                },
                body: JSON.stringify({ query: 'What products?' }),
            });
            const response = await POST_memoryQuery(request);
            expect(response.status).toBe(404);
        });
    });

    // ─── Policy Evaluation ───────────────────────────────────────────────────

    describe('Policy eval uses sealed inference for sensitive data', () => {
        it('evaluates a normal scenario and returns allow decision', async () => {
            setupApiKeyMock();
            setupMemorySourceMocks();
            setupComputeJobMocks();

            mockRunStructuredInference.mockResolvedValue({
                output: {
                    decision: 'allow',
                    rationale: 'The merchant settings support this workflow.',
                    citations: ['merchant:settings'],
                    nextActions: ['Proceed with the payment flow'],
                },
                provider: '0g-test-provider',
                model: 'test-model-v1',
                verificationStatus: 'sealed_tee',
            });

            const request = new Request('http://localhost/api/agent/commerce/policy-eval', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': 'password',
                },
                body: JSON.stringify({
                    scenario: 'Customer wants to purchase Pro Plan via USDC on Base',
                }),
            });
            const response = await POST_policyEval(request);

            expect(response.status).toBe(200);
            const body = await response.json();

            expect(body.evaluation.decision).toBe('allow');
            expect(body.evaluation.rationale).toBeTruthy();
            expect(body.source).toBe('0g_compute');
            expect(body.computeJobId).toBe(COMPUTE_JOB_ID);
        });

        it('falls back to rule-based review for refund scenarios when compute fails', async () => {
            setupApiKeyMock();
            setupMemorySourceMocks();
            setupComputeJobMocks();

            mockRunStructuredInference.mockRejectedValue(new Error('Compute unavailable'));

            const request = new Request('http://localhost/api/agent/commerce/policy-eval', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': 'password',
                },
                body: JSON.stringify({
                    scenario: 'Customer is requesting a refund for their last purchase',
                }),
            });
            const response = await POST_policyEval(request);

            expect(response.status).toBe(200);
            const body = await response.json();

            expect(body.evaluation.decision).toBe('review');
            expect(body.evaluation.rationale).toContain('refund');
            expect(body.source).toBe('fallback');
        });

        it('falls back to deny when scenario requires webhook but none is configured', async () => {
            setupApiKeyMock();
            // Set up memory source with no webhook URL
            mockGetLatestArtifact.mockResolvedValue({
                storageRoot: '0xmemory_root',
                storageUri: '0g://log/0xmemory_root',
                payloadHash: '0xmemory_hash',
                storageTxHash: '0xmemory_tx',
                kind: 'merchant_memory_snapshot',
                metadata: { logicalPayloadHash: '0xlogical' },
            });
            mockLoadJsonArtifact.mockResolvedValue({
                payload: {
                    ...MEMORY_SNAPSHOT,
                    settings: { ...MEMORY_SNAPSHOT.settings, webhookUrl: null },
                    merchant: { ...MEMORY_SNAPSHOT.merchant, webhookUrl: null },
                },
                download: { byteSize: 1024, durationMs: 50 },
            });
            setupComputeJobMocks();
            mockRunStructuredInference.mockRejectedValue(new Error('Compute down'));

            const request = new Request('http://localhost/api/agent/commerce/policy-eval', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': 'password',
                },
                body: JSON.stringify({
                    scenario: 'Set up a webhook notification for completed payments',
                }),
            });
            const response = await POST_policyEval(request);

            expect(response.status).toBe(200);
            const body = await response.json();

            expect(body.evaluation.decision).toBe('deny');
            expect(body.evaluation.rationale).toContain('webhook');
        });

        it('returns 401 when API key is invalid', async () => {
            mockApiKeyFindFirst.mockResolvedValue(null);

            const request = new Request('http://localhost/api/agent/commerce/policy-eval', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': 'invalid_key',
                },
                body: JSON.stringify({ scenario: 'Test scenario' }),
            });
            const response = await POST_policyEval(request);
            expect(response.status).toBe(401);
        });
    });

    // ─── Response Schema Validation ──────────────────────────────────────────

    describe('Response schemas validate correctly', () => {
        it('memory query response includes required fields: answer, citations, recommendedActions', async () => {
            setupApiKeyMock();
            setupMemorySourceMocks();
            setupComputeJobMocks();

            mockRunStructuredInference.mockResolvedValue({
                output: {
                    answer: 'Structured answer from AI',
                    citations: ['product:prod_1'],
                    recommendedActions: ['Next step'],
                },
                provider: '0g-test-provider',
                model: 'test-model-v1',
                verificationStatus: 'direct_secret',
            });

            const request = new Request('http://localhost/api/agent/memory/query', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': 'password',
                },
                body: JSON.stringify({ query: 'Schema validation test' }),
            });
            const response = await POST_memoryQuery(request);
            const body = await response.json();

            expect(body.response).toHaveProperty('answer');
            expect(body.response).toHaveProperty('citations');
            expect(body.response).toHaveProperty('recommendedActions');
            expect(Array.isArray(body.response.citations)).toBe(true);
            expect(Array.isArray(body.response.recommendedActions)).toBe(true);
        });

        it('normalizes LLM object citations into string citations', async () => {
            setupApiKeyMock();
            setupMemorySourceMocks();
            setupComputeJobMocks();

            // LLM returns citations as objects instead of strings
            mockRunStructuredInference.mockResolvedValue({
                output: {
                    answer: 'Result',
                    citations: [
                        { type: 'product', id: 'prod_1' },
                        { field: 'name', value: 'Pro Plan' },
                    ],
                    recommendedActions: ['Check paywall'],
                },
                provider: '0g-test-provider',
                model: 'test-model-v1',
                verificationStatus: 'sealed_tee',
            });

            const request = new Request('http://localhost/api/agent/memory/query', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-api-key': 'password',
                },
                body: JSON.stringify({ query: 'Test normalization' }),
            });
            const response = await POST_memoryQuery(request);
            const body = await response.json();

            // normalizeStructuredStringList should convert objects to strings
            expect(body.response.citations.every((c: unknown) => typeof c === 'string')).toBe(true);
        });
    });
});
