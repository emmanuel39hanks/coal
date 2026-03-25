/**
 * E2E flow test: 0G Console Dashboard
 *
 * Exercises the health endpoint (4 checks: storage, chain, compute, DA),
 * the console endpoint (sealed inference status, DA health, activity feed,
 * stats with sealed query count), and the publish action.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock external dependencies ──────────────────────────────────────────────

const mockStoredArtifactFindMany = vi.fn();
const mockChainAnchorFindMany = vi.fn();
const mockComputeJobFindMany = vi.fn();
const mockCheckoutSessionCount = vi.fn();
const mockUserFindUnique = vi.fn();

vi.mock('@/lib/prisma', () => ({
    prisma: {
        storedArtifact: {
            findMany: (...args: unknown[]) => mockStoredArtifactFindMany(...args),
            create: vi.fn(),
        },
        chainAnchor: {
            findMany: (...args: unknown[]) => mockChainAnchorFindMany(...args),
        },
        computeJob: {
            findMany: (...args: unknown[]) => mockComputeJobFindMany(...args),
        },
        checkoutSession: {
            count: (...args: unknown[]) => mockCheckoutSessionCount(...args),
        },
        user: {
            findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
        },
    },
}));

vi.mock('@/lib/logger', () => ({
    zeroGLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockGetAuthUser = vi.fn();
vi.mock('@/lib/privy', () => ({
    getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
    hasWriteAccess: () => true,
}));

vi.mock('@/lib/rate-limit', () => ({
    getIP: () => '127.0.0.1',
    checkRateLimit: vi.fn().mockResolvedValue({ limited: false, headers: {} }),
    rateLimiters: { public: {} },
}));

const mockCheckStorageHealth = vi.fn();
const mockGetStoragePerformancePlaybook = vi.fn();
vi.mock('@/lib/0g/storage', () => ({
    checkStorageHealth: (...args: unknown[]) => mockCheckStorageHealth(...args),
    getStoragePerformancePlaybook: (...args: unknown[]) => mockGetStoragePerformancePlaybook(...args),
    publishJson: vi.fn(),
    publishEncryptedJson: vi.fn(),
    upsertMutableJson: vi.fn(),
    loadJsonArtifact: vi.fn(),
    sha256Hex: vi.fn(() => '0xhash'),
    stableJsonStringify: vi.fn((v: unknown) => JSON.stringify(v)),
}));

const mockCheckZeroGChainHealth = vi.fn();
vi.mock('@/lib/0g/chain', () => ({
    checkZeroGChainHealth: (...args: unknown[]) => mockCheckZeroGChainHealth(...args),
}));

const mockListComputeServices = vi.fn();
const mockIsSealedInferenceEnabled = vi.fn();
vi.mock('@/lib/0g/compute', () => ({
    listComputeServices: (...args: unknown[]) => mockListComputeServices(...args),
    isSealedInferenceEnabled: () => mockIsSealedInferenceEnabled(),
}));

const mockCheckDAHealth = vi.fn();
vi.mock('@/lib/0g/da', () => ({
    checkDAHealth: (...args: unknown[]) => mockCheckDAHealth(...args),
}));

const mockGetMerchantZeroGState = vi.fn();
const mockSyncMerchantArtifacts = vi.fn();
vi.mock('@/lib/0g/merchant', () => ({
    getMerchantZeroGState: (...args: unknown[]) => mockGetMerchantZeroGState(...args),
    syncMerchantArtifacts: (...args: unknown[]) => mockSyncMerchantArtifacts(...args),
    getMerchantMemorySource: vi.fn(),
}));

const mockGetLatestArtifact = vi.fn();
vi.mock('@/lib/0g/catalog', () => ({
    getLatestArtifact: (...args: unknown[]) => mockGetLatestArtifact(...args),
    buildZeroGStreamId: vi.fn(() => '0xstream'),
}));

vi.mock('@/lib/0g/env', () => ({
    zeroGEnv: {
        enabled: true,
        computeEnabled: true,
        computeBaseUrl: 'https://compute.0g.test',
        computeApiKey: 'test_key',
        computeProvider: '0g-test-provider',
        computeModel: 'test-model-v1',
        storageScanBaseUrl: 'https://storagescan.0g.ai',
        chainScanBaseUrl: 'https://chainscan.0g.ai',
        storageTargetMbps: 200,
        chainRpcUrl: 'https://rpc.0g.test',
        chainId: 16661,
    },
    isZeroGEnabled: () => true,
    isZeroGComputeConfigured: () => true,
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

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MERCHANT_ID = 'merchant_dashboard_test';
const NOW = new Date('2026-03-25T12:00:00.000Z');

const ARTIFACTS = [
    {
        id: 'art_1',
        kind: 'receipt_payload',
        status: 'published',
        storageUri: '0g://log/0xreceipt1',
        storageRoot: '0xreceipt_root_1',
        storageTxHash: '0xreceipt_stx_1',
        payloadHash: '0xreceipt_hash_1',
        merchantId: MERCHANT_ID,
        createdAt: new Date('2026-03-25T11:00:00.000Z'),
    },
    {
        id: 'art_2',
        kind: 'merchant_profile',
        status: 'published',
        storageUri: '0g://log/0xprofile1',
        storageRoot: '0xprofile_root_1',
        storageTxHash: '0xprofile_stx_1',
        payloadHash: '0xprofile_hash_1',
        merchantId: MERCHANT_ID,
        createdAt: new Date('2026-03-25T10:00:00.000Z'),
    },
    {
        id: 'art_3',
        kind: 'paywall_manifest',
        status: 'published',
        storageUri: '0g://log/0xmanifest1',
        storageRoot: '0xmanifest_root_1',
        storageTxHash: '0xmanifest_stx_1',
        payloadHash: '0xmanifest_hash_1',
        merchantId: MERCHANT_ID,
        createdAt: new Date('2026-03-25T09:00:00.000Z'),
    },
    {
        id: 'art_4',
        kind: 'merchant_memory_snapshot',
        status: 'published',
        storageUri: '0g://log/0xmemory1',
        storageRoot: '0xmemory_root_1',
        storageTxHash: '0xmemory_stx_1',
        payloadHash: '0xmemory_hash_1',
        merchantId: MERCHANT_ID,
        createdAt: new Date('2026-03-25T08:00:00.000Z'),
    },
];

const ANCHORS = [
    {
        id: 'anc_1',
        kind: 'receipt_payload',
        status: 'confirmed',
        anchorTxHash: '0xanchor_tx_1',
        anchorChainId: 16661,
        payloadHash: '0xreceipt_hash_1',
        merchantId: MERCHANT_ID,
        createdAt: new Date('2026-03-25T11:01:00.000Z'),
    },
];

const COMPUTE_JOBS = [
    {
        id: 'cj_1',
        kind: 'memory_query',
        status: 'completed',
        model: 'test-model-v1',
        provider: '0g-test-provider',
        verificationStatus: 'sealed_tee',
        startedAt: new Date('2026-03-25T10:30:00.000Z'),
        completedAt: new Date('2026-03-25T10:30:05.000Z'),
        createdAt: new Date('2026-03-25T10:30:00.000Z'),
        errorMessage: null,
        merchantId: MERCHANT_ID,
    },
    {
        id: 'cj_2',
        kind: 'policy_eval',
        status: 'completed',
        model: 'test-model-v1',
        provider: '0g-test-provider',
        verificationStatus: 'sealed_tee',
        startedAt: new Date('2026-03-25T10:35:00.000Z'),
        completedAt: new Date('2026-03-25T10:35:03.000Z'),
        createdAt: new Date('2026-03-25T10:35:00.000Z'),
        errorMessage: null,
        merchantId: MERCHANT_ID,
    },
    {
        id: 'cj_3',
        kind: 'memory_query',
        status: 'failed',
        model: 'test-model-v1',
        provider: '0g-test-provider',
        verificationStatus: null,
        startedAt: new Date('2026-03-25T10:40:00.000Z'),
        completedAt: new Date('2026-03-25T10:40:10.000Z'),
        createdAt: new Date('2026-03-25T10:40:00.000Z'),
        errorMessage: 'Compute timeout',
        merchantId: MERCHANT_ID,
    },
];

function setupHealthyServiceMocks() {
    mockCheckStorageHealth.mockResolvedValue({
        ok: true,
        indexerUrl: 'https://indexer-storage-turbo.0g.ai',
    });
    mockCheckZeroGChainHealth.mockResolvedValue({
        chainId: 16661,
        blockNumber: 999999,
        rpcUrl: 'https://rpc.0g.test',
    });
    mockListComputeServices.mockResolvedValue([
        {
            providerAddress: '0xprovider1',
            model: 'test-model-v1',
            endpoint: 'https://compute.0g.test',
            serviceName: 'test-service',
            uptimePct: 99.5,
            avgLatencyMs: 200,
        },
    ]);
    mockCheckDAHealth.mockResolvedValue({
        enabled: true,
        configured: true,
        connected: true,
        grpcUrl: 'localhost:51001',
    });
}

function setupConsoleMocks() {
    mockGetAuthUser.mockResolvedValue({ id: MERCHANT_ID });
    mockStoredArtifactFindMany.mockResolvedValue(ARTIFACTS);
    mockChainAnchorFindMany.mockResolvedValue(ANCHORS);
    mockComputeJobFindMany.mockResolvedValue(COMPUTE_JOBS);
    mockCheckoutSessionCount.mockResolvedValue(42);
    mockIsSealedInferenceEnabled.mockReturnValue(true);
    mockGetMerchantZeroGState.mockResolvedValue({
        profile: {
            name: 'Dashboard Test Merchant',
            updatedAt: NOW.toISOString(),
            productCount: 3,
            paywallCount: 2,
        },
        memory: {
            capturedAt: NOW.toISOString(),
            products: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
            paywalls: [{ id: 'pw1' }, { id: 'pw2' }],
        },
        published: {
            profile: {
                storageUri: '0g://log/0xprofile1',
                storageRoot: '0xprofile_root_1',
                storageTxHash: '0xprofile_stx_1',
                createdAt: new Date('2026-03-25T10:00:00.000Z'),
            },
            memory: {
                storageUri: '0g://log/0xmemory1',
                storageTxHash: '0xmemory_stx_1',
                createdAt: new Date('2026-03-25T08:00:00.000Z'),
            },
        },
    });
}

// ─── Test Suites ─────────────────────────────────────────────────────────────

let GET_health: typeof import('@/app/api/0g/health/route').GET;
let GET_console: typeof import('@/app/api/console/0g/route').GET;
let POST_console: typeof import('@/app/api/console/0g/route').POST;

beforeAll(async () => {
    ({ GET: GET_health } = await import('@/app/api/0g/health/route'));
    ({ GET: GET_console, POST: POST_console } = await import('@/app/api/console/0g/route'));
});

describe('0G Dashboard E2E Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ─── Health Endpoint ─────────────────────────────────────────────────────

    describe('Health endpoint returns all 4 checks', () => {
        it('returns all 4 checks: storage, chain, compute, DA when healthy', async () => {
            setupHealthyServiceMocks();
            mockGetStoragePerformancePlaybook.mockReturnValue({ status: 'optimal' });

            const request = new Request('http://localhost/api/0g/health');
            const response = await GET_health(new Request('http://localhost/api/0g/health'));

            expect(response.status).toBe(200);
            const body = await response.json();

            expect(body.status).toBe('ok');
            expect(body.checks).toHaveProperty('storage');
            expect(body.checks).toHaveProperty('chain');
            expect(body.checks).toHaveProperty('compute');
            expect(body.checks).toHaveProperty('da');

            expect(body.checks.storage.ok).toBe(true);
            expect(body.checks.chain.ok).toBe(true);
            expect(body.checks.compute.ok).toBe(true);
            expect(body.checks.da.ok).toBe(true);
        });

        it('returns degraded status when one check fails', async () => {
            mockCheckStorageHealth.mockRejectedValue(new Error('Storage unreachable'));
            mockCheckZeroGChainHealth.mockResolvedValue({
                chainId: 16661,
                blockNumber: 999999,
            });
            mockListComputeServices.mockResolvedValue([]);
            mockCheckDAHealth.mockResolvedValue({
                enabled: true,
                configured: true,
                connected: true,
                grpcUrl: 'localhost:51001',
            });
            mockGetStoragePerformancePlaybook.mockReturnValue({ status: 'degraded' });

            const response = await GET_health(new Request('http://localhost/api/0g/health'));
            const body = await response.json();

            expect(body.status).toBe('degraded');
            expect(body.checks.storage.ok).toBe(false);
            expect(body.checks.storage.error).toBe('0G storage unavailable');
        });

        it('includes DA health check in the response', async () => {
            setupHealthyServiceMocks();
            mockGetStoragePerformancePlaybook.mockReturnValue({ status: 'optimal' });

            const response = await GET_health(new Request('http://localhost/api/0g/health'));
            const body = await response.json();

            expect(body.checks.da).toBeDefined();
            expect(body.checks.da.ok).toBe(true);
            expect(body.checks.da.details).toMatchObject({
                enabled: true,
                connected: true,
            });
        });

        it('DA check ok when DA is disabled (not blocking)', async () => {
            mockCheckStorageHealth.mockResolvedValue({ ok: true });
            mockCheckZeroGChainHealth.mockResolvedValue({ chainId: 16661 });
            mockListComputeServices.mockResolvedValue([]);
            mockCheckDAHealth.mockResolvedValue({
                enabled: false,
                configured: false,
                connected: false,
                grpcUrl: 'localhost:51001',
            });
            mockGetStoragePerformancePlaybook.mockReturnValue({ status: 'optimal' });

            const response = await GET_health(new Request('http://localhost/api/0g/health'));
            const body = await response.json();

            // DA disabled means ok: true (not blocking)
            expect(body.checks.da.ok).toBe(true);
        });

        it('includes compute provider info in health details', async () => {
            setupHealthyServiceMocks();
            mockGetStoragePerformancePlaybook.mockReturnValue({ status: 'optimal' });

            const response = await GET_health(new Request('http://localhost/api/0g/health'));
            const body = await response.json();

            expect(body.checks.compute.details.enabled).toBe(true);
            expect(body.checks.compute.details.serviceCount).toBe(1);
        });
    });

    // ─── Console Endpoint ────────────────────────────────────────────────────

    describe('Console endpoint includes sealed inference status', () => {
        it('returns sealedInference status with query count', async () => {
            setupConsoleMocks();
            setupHealthyServiceMocks();

            const request = new Request('http://localhost/api/console/0g');
            const response = await GET_console(request);

            expect(response.status).toBe(200);
            const body = await response.json();

            expect(body.sealedInference).toBeDefined();
            expect(body.sealedInference.enabled).toBe(true);
            // 2 sealed_tee jobs in fixtures (cj_1, cj_2)
            expect(body.sealedInference.queriesProcessed).toBe(2);
        });

        it('includes DA health in checks', async () => {
            setupConsoleMocks();
            setupHealthyServiceMocks();

            const request = new Request('http://localhost/api/console/0g');
            const response = await GET_console(request);
            const body = await response.json();

            expect(body.checks.da).toBeDefined();
            expect(body.checks.da.ok).toBe(true);
        });

        it('returns 401 when not authenticated', async () => {
            mockGetAuthUser.mockResolvedValue(null);

            const request = new Request('http://localhost/api/console/0g');
            const response = await GET_console(request);
            expect(response.status).toBe(401);
        });
    });

    describe('Activity feed merges artifacts + anchors + compute jobs', () => {
        it('merges all three sources into a unified, reverse-chronological feed', async () => {
            setupConsoleMocks();
            setupHealthyServiceMocks();

            const request = new Request('http://localhost/api/console/0g');
            const response = await GET_console(request);
            const body = await response.json();

            expect(body.activity).toBeDefined();
            expect(Array.isArray(body.activity)).toBe(true);

            // Total: 4 artifacts + 1 anchor + 3 compute jobs = 8
            expect(body.activity.length).toBe(8);

            // Verify types exist
            const types = new Set(body.activity.map((a: { type: string }) => a.type));
            expect(types.has('artifact')).toBe(true);
            expect(types.has('anchor')).toBe(true);
            expect(types.has('compute')).toBe(true);

            // Verify sorted by createdAt descending
            for (let i = 1; i < body.activity.length; i++) {
                const prev = new Date(body.activity[i - 1].createdAt).getTime();
                const curr = new Date(body.activity[i].createdAt).getTime();
                expect(prev).toBeGreaterThanOrEqual(curr);
            }
        });

        it('artifact entries include explorer URLs from storageScan', async () => {
            setupConsoleMocks();
            setupHealthyServiceMocks();

            const request = new Request('http://localhost/api/console/0g');
            const response = await GET_console(request);
            const body = await response.json();

            const artifactEntry = body.activity.find(
                (a: { type: string; kind: string }) => a.type === 'artifact' && a.kind === 'receipt_payload',
            );
            expect(artifactEntry).toBeDefined();
            expect(artifactEntry.explorerUrl).toBe(
                'https://storagescan.0g.ai/tx/0xreceipt_stx_1',
            );
        });

        it('anchor entries include explorer URLs from chainScan', async () => {
            setupConsoleMocks();
            setupHealthyServiceMocks();

            const request = new Request('http://localhost/api/console/0g');
            const response = await GET_console(request);
            const body = await response.json();

            const anchorEntry = body.activity.find(
                (a: { type: string }) => a.type === 'anchor',
            );
            expect(anchorEntry).toBeDefined();
            expect(anchorEntry.explorerUrl).toBe(
                'https://chainscan.0g.ai/tx/0xanchor_tx_1',
            );
        });

        it('compute entries include model, provider, and error info', async () => {
            setupConsoleMocks();
            setupHealthyServiceMocks();

            const request = new Request('http://localhost/api/console/0g');
            const response = await GET_console(request);
            const body = await response.json();

            const failedCompute = body.activity.find(
                (a: { type: string; status: string }) => a.type === 'compute' && a.status === 'failed',
            );
            expect(failedCompute).toBeDefined();
            expect(failedCompute.model).toBe('test-model-v1');
            expect(failedCompute.provider).toBe('0g-test-provider');
            expect(failedCompute.errorMessage).toBe('Compute timeout');
        });
    });

    describe('Stats include sealed query count', () => {
        it('returns comprehensive stats with sealed query count', async () => {
            setupConsoleMocks();
            setupHealthyServiceMocks();

            const request = new Request('http://localhost/api/console/0g');
            const response = await GET_console(request);
            const body = await response.json();

            expect(body.stats).toBeDefined();
            expect(body.stats.receiptsStored).toBe(1); // 1 receipt_payload artifact
            expect(body.stats.profilePublished).toBe(true); // 1 merchant_profile artifact
            expect(body.stats.memoryPublished).toBe(true); // 1 memory_snapshot artifact
            expect(body.stats.paywallManifests).toBe(1); // 1 paywall_manifest artifact
            expect(body.stats.aiQueries).toBe(3); // 3 compute jobs
            expect(body.stats.sealedQueries).toBe(2); // 2 sealed_tee jobs
            expect(body.stats.confirmedPayments).toBe(42);
        });

        it('returns zero sealed queries when none exist', async () => {
            setupConsoleMocks();
            setupHealthyServiceMocks();
            // Override with no sealed jobs
            mockComputeJobFindMany.mockResolvedValue([
                {
                    id: 'cj_noseal',
                    kind: 'memory_query',
                    status: 'completed',
                    model: 'test-model-v1',
                    provider: '0g-test-provider',
                    verificationStatus: 'direct_secret',
                    startedAt: NOW,
                    completedAt: NOW,
                    createdAt: NOW,
                    errorMessage: null,
                    merchantId: MERCHANT_ID,
                },
            ]);

            const request = new Request('http://localhost/api/console/0g');
            const response = await GET_console(request);
            const body = await response.json();

            expect(body.stats.sealedQueries).toBe(0);
            expect(body.sealedInference.queriesProcessed).toBe(0);
        });
    });

    // ─── Publish action ──────────────────────────────────────────────────────

    describe('Publish action triggers merchant artifact sync', () => {
        it('POST triggers syncMerchantArtifacts and returns published result', async () => {
            mockGetAuthUser.mockResolvedValue({ id: MERCHANT_ID });
            mockSyncMerchantArtifacts.mockResolvedValue({
                profile: { skipped: false },
                memory: { skipped: false },
            });

            const request = new Request('http://localhost/api/console/0g', {
                method: 'POST',
            });
            const response = await POST_console(request);

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.published).toBe(true);
            expect(mockSyncMerchantArtifacts).toHaveBeenCalledWith(MERCHANT_ID);
        });

        it('POST returns 401 when not authenticated', async () => {
            mockGetAuthUser.mockResolvedValue(null);

            const request = new Request('http://localhost/api/console/0g', {
                method: 'POST',
            });
            const response = await POST_console(request);
            expect(response.status).toBe(401);
        });
    });

    // ─── Status aggregation ──────────────────────────────────────────────────

    describe('Overall status aggregation', () => {
        it('returns ok when all checks pass', async () => {
            setupConsoleMocks();
            setupHealthyServiceMocks();

            const request = new Request('http://localhost/api/console/0g');
            const response = await GET_console(request);
            const body = await response.json();

            expect(body.status).toBe('ok');
        });

        it('returns degraded when any check fails', async () => {
            setupConsoleMocks();
            // Make storage fail
            mockCheckStorageHealth.mockRejectedValue(new Error('Storage offline'));
            mockCheckZeroGChainHealth.mockResolvedValue({ chainId: 16661 });
            mockListComputeServices.mockResolvedValue([]);
            mockCheckDAHealth.mockResolvedValue({
                enabled: true,
                configured: true,
                connected: true,
                grpcUrl: 'localhost:51001',
            });

            const request = new Request('http://localhost/api/console/0g');
            const response = await GET_console(request);
            const body = await response.json();

            expect(body.status).toBe('degraded');
        });
    });
});
