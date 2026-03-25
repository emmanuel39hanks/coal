import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckStorageHealth = vi.fn();
const mockGetStoragePerformancePlaybook = vi.fn();
const mockCheckZeroGChainHealth = vi.fn();
const mockListComputeServices = vi.fn();
const mockCheckDAHealth = vi.fn();
const mockIsSealedInferenceEnabled = vi.fn();
const mockGetAuthUser = vi.fn();
const mockGetMerchantZeroGState = vi.fn();
const mockSyncMerchantArtifacts = vi.fn();

vi.mock('@/lib/0g/storage', () => ({
  checkStorageHealth: mockCheckStorageHealth,
  getStoragePerformancePlaybook: mockGetStoragePerformancePlaybook,
}));

vi.mock('@/lib/0g/chain', () => ({
  checkZeroGChainHealth: mockCheckZeroGChainHealth,
}));

vi.mock('@/lib/0g/compute', () => ({
  listComputeServices: mockListComputeServices,
  isSealedInferenceEnabled: mockIsSealedInferenceEnabled,
}));

vi.mock('@/lib/0g/da', () => ({
  checkDAHealth: mockCheckDAHealth,
}));

vi.mock('@/lib/0g/merchant', () => ({
  getMerchantZeroGState: mockGetMerchantZeroGState,
  syncMerchantArtifacts: mockSyncMerchantArtifacts,
}));

vi.mock('@/lib/privy', () => ({
  getAuthUser: mockGetAuthUser,
  hasWriteAccess: () => true,
}));

vi.mock('@/lib/rate-limit', () => ({
  getIP: () => '127.0.0.1',
  checkRateLimit: vi.fn().mockResolvedValue({ limited: false, headers: {} }),
  rateLimiters: { public: {} },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    storedArtifact: { findMany: vi.fn().mockResolvedValue([]) },
    chainAnchor: { findMany: vi.fn().mockResolvedValue([]) },
    computeJob: { findMany: vi.fn().mockResolvedValue([]) },
    checkoutSession: { count: vi.fn().mockResolvedValue(0) },
  },
}));

vi.mock('@/lib/errors', async () => {
  const { NextResponse } = await import('next/server');
  return {
    apiSuccess: <T>(data: T) => NextResponse.json(data, { status: 200 }),
    errors: {
      unauthorized: () =>
        NextResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
          { status: 401 },
        ),
      internal: (message = 'Internal server error') =>
        NextResponse.json(
          { error: { code: 'INTERNAL_ERROR', message } },
          { status: 500 },
        ),
    },
  };
});

// ─── /api/0g/health ───────────────────────────────────────────────────────────

describe('GET /api/0g/health', () => {
  let healthGET: typeof import('@/app/api/0g/health/route').GET;

  beforeAll(async () => {
    // Need to set env mock before importing the route
    vi.doMock('@/lib/0g/env', () => ({
      zeroGEnv: {
        enabled: true,
        computeEnabled: true,
        computeBaseUrl: 'https://compute.0g.ai',
        computeApiKey: 'test-key',
        computeProvider: 'test-provider',
        computeModel: 'test-model',
        storageTargetMbps: 200,
        storageScanBaseUrl: 'https://storagescan.0g.ai',
        chainScanBaseUrl: 'https://chainscan.0g.ai',
      },
    }));

    ({ GET: healthGET } = await import('@/app/api/0g/health/route'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ok status when all checks pass', async () => {
    mockCheckStorageHealth.mockResolvedValue({ connected: true });
    mockCheckZeroGChainHealth.mockResolvedValue({ connected: true });
    mockListComputeServices.mockResolvedValue([
      {
        providerAddress: '0xprovider',
        model: 'test-model',
        endpoint: 'https://endpoint.example',
        serviceName: 'TestService',
        uptimePct: 99.5,
        avgLatencyMs: 150,
      },
    ]);
    mockCheckDAHealth.mockResolvedValue({
      enabled: true,
      configured: true,
      connected: true,
      grpcUrl: 'localhost:51001',
    });
    mockGetStoragePerformancePlaybook.mockReturnValue('default');

    const response = await healthGET(new Request('http://localhost/api/0g/health'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeTruthy();
    expect(body.checks).toBeDefined();
    expect(body.checks.storage.ok).toBe(true);
    expect(body.checks.chain.ok).toBe(true);
    expect(body.checks.compute.ok).toBe(true);
    expect(body.checks.da.ok).toBe(true);
  });

  it('returns degraded status when any check fails', async () => {
    mockCheckStorageHealth.mockResolvedValue({ connected: true });
    mockCheckZeroGChainHealth.mockRejectedValue(new Error('Chain RPC unreachable'));
    mockListComputeServices.mockResolvedValue([]);
    mockCheckDAHealth.mockResolvedValue({
      enabled: true,
      configured: true,
      connected: true,
      grpcUrl: 'localhost:51001',
    });
    mockGetStoragePerformancePlaybook.mockReturnValue('default');

    const response = await healthGET(new Request('http://localhost/api/0g/health'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('degraded');
    expect(body.checks.chain.ok).toBe(false);
    expect(body.checks.chain.error).toBe('0G chain unavailable');
  });

  it('includes DA health check result in the response', async () => {
    mockCheckStorageHealth.mockResolvedValue({ connected: true });
    mockCheckZeroGChainHealth.mockResolvedValue({ connected: true });
    mockListComputeServices.mockResolvedValue([]);
    mockCheckDAHealth.mockResolvedValue({
      enabled: true,
      configured: true,
      connected: false,
      grpcUrl: 'localhost:51001',
      error: 'DA sidecar connection failed',
    });
    mockGetStoragePerformancePlaybook.mockReturnValue('default');

    const response = await healthGET(new Request('http://localhost/api/0g/health'));
    const body = await response.json();

    expect(body.checks.da.ok).toBe(false);
    expect(body.checks.da.details.connected).toBe(false);
  });

  it('reports DA as ok when DA is disabled (not required)', async () => {
    mockCheckStorageHealth.mockResolvedValue({ connected: true });
    mockCheckZeroGChainHealth.mockResolvedValue({ connected: true });
    mockListComputeServices.mockResolvedValue([]);
    mockCheckDAHealth.mockResolvedValue({
      enabled: false,
      configured: false,
      connected: false,
      grpcUrl: 'localhost:51001',
    });
    mockGetStoragePerformancePlaybook.mockReturnValue('default');

    const response = await healthGET(new Request('http://localhost/api/0g/health'));
    const body = await response.json();

    // DA check should be ok because DA is simply not enabled
    expect(body.checks.da.ok).toBe(true);
  });

  it('includes compute service discovery results', async () => {
    mockCheckStorageHealth.mockResolvedValue({ connected: true });
    mockCheckZeroGChainHealth.mockResolvedValue({ connected: true });
    mockListComputeServices.mockResolvedValue([
      {
        providerAddress: '0xprovider1',
        model: 'model-a',
        endpoint: 'https://a.example',
        serviceName: 'ServiceA',
        uptimePct: 99.0,
        avgLatencyMs: 100,
      },
      {
        providerAddress: '0xprovider2',
        model: 'model-b',
        endpoint: null,
        serviceName: null,
        uptimePct: null,
        avgLatencyMs: null,
      },
    ]);
    mockCheckDAHealth.mockResolvedValue({
      enabled: false,
      configured: false,
      connected: false,
      grpcUrl: 'localhost:51001',
    });
    mockGetStoragePerformancePlaybook.mockReturnValue('default');

    const response = await healthGET(new Request('http://localhost/api/0g/health'));
    const body = await response.json();

    expect(body.checks.compute.ok).toBe(true);
    expect(body.checks.compute.details.serviceCount).toBe(2);
  });

  it('handles storage health check failure gracefully', async () => {
    mockCheckStorageHealth.mockRejectedValue(new Error('Storage timeout'));
    mockCheckZeroGChainHealth.mockResolvedValue({ connected: true });
    mockListComputeServices.mockResolvedValue([]);
    mockCheckDAHealth.mockResolvedValue({
      enabled: false,
      configured: false,
      connected: false,
      grpcUrl: 'localhost:51001',
    });
    mockGetStoragePerformancePlaybook.mockReturnValue('default');

    const response = await healthGET(new Request('http://localhost/api/0g/health'));
    const body = await response.json();

    expect(body.status).toBe('degraded');
    expect(body.checks.storage.ok).toBe(false);
    expect(body.checks.storage.error).toBe('0G storage unavailable');
  });

  it('includes storage target Mbps and retrieval playbook', async () => {
    mockCheckStorageHealth.mockResolvedValue({ connected: true });
    mockCheckZeroGChainHealth.mockResolvedValue({ connected: true });
    mockListComputeServices.mockResolvedValue([]);
    mockCheckDAHealth.mockResolvedValue({
      enabled: false,
      configured: false,
      connected: false,
      grpcUrl: 'localhost:51001',
    });
    mockGetStoragePerformancePlaybook.mockReturnValue('turbo');

    const response = await healthGET(new Request('http://localhost/api/0g/health'));
    const body = await response.json();

    expect(body.targetStorageMbps).toBe(200);
    expect(body.retrievalPlaybook).toBe('turbo');
  });
});

// ─── /api/console/0g (GET — sealed inference status) ──────────────────────────

describe('GET /api/console/0g', () => {
  let consoleGET: typeof import('@/app/api/console/0g/route').GET;

  beforeAll(async () => {
    vi.doMock('@/lib/0g/env', () => ({
      zeroGEnv: {
        enabled: true,
        computeEnabled: true,
        computeBaseUrl: 'https://compute.0g.ai',
        computeApiKey: 'test-key',
        computeProvider: 'test-provider',
        computeModel: 'test-model',
        storageTargetMbps: 200,
        storageScanBaseUrl: 'https://storagescan.0g.ai',
        chainScanBaseUrl: 'https://chainscan.0g.ai',
      },
    }));

    ({ GET: consoleGET } = await import('@/app/api/console/0g/route'));
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock setup for authenticated user
    mockGetAuthUser.mockResolvedValue({ id: 'merchant_test_123' });
    mockGetMerchantZeroGState.mockResolvedValue({
      profile: null,
      memory: null,
      published: { profile: null, memory: null },
    });
    mockCheckStorageHealth.mockResolvedValue({ connected: true });
    mockCheckZeroGChainHealth.mockResolvedValue({ connected: true });
    mockListComputeServices.mockResolvedValue([]);
    mockCheckDAHealth.mockResolvedValue({
      enabled: false,
      configured: false,
      connected: false,
      grpcUrl: 'localhost:51001',
    });
  });

  it('includes sealedInference status in response', async () => {
    mockIsSealedInferenceEnabled.mockReturnValue(true);

    const request = new Request('http://localhost/api/console/0g');
    const response = await consoleGET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sealedInference).toBeDefined();
    expect(body.sealedInference.enabled).toBe(true);
    expect(typeof body.sealedInference.queriesProcessed).toBe('number');
  });

  it('reports sealed inference as disabled when env flag is off', async () => {
    mockIsSealedInferenceEnabled.mockReturnValue(false);

    const request = new Request('http://localhost/api/console/0g');
    const response = await consoleGET(request);
    const body = await response.json();

    expect(body.sealedInference.enabled).toBe(false);
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const request = new Request('http://localhost/api/console/0g');
    const response = await consoleGET(request);

    expect(response.status).toBe(401);
  });

  it('includes DA check results', async () => {
    mockIsSealedInferenceEnabled.mockReturnValue(false);
    mockCheckDAHealth.mockResolvedValue({
      enabled: true,
      configured: true,
      connected: true,
      grpcUrl: 'localhost:51001',
    });

    const request = new Request('http://localhost/api/console/0g');
    const response = await consoleGET(request);
    const body = await response.json();

    expect(body.checks.da.ok).toBe(true);
    expect(body.checks.da.details.connected).toBe(true);
  });

  it('includes explorer URLs from env config', async () => {
    mockIsSealedInferenceEnabled.mockReturnValue(false);

    const request = new Request('http://localhost/api/console/0g');
    const response = await consoleGET(request);
    const body = await response.json();

    expect(body.explorers.storageScan).toContain('storagescan.0g.ai');
    expect(body.explorers.chainScan).toContain('chainscan.0g.ai');
  });

  it('includes merchant id in the response', async () => {
    mockIsSealedInferenceEnabled.mockReturnValue(false);

    const request = new Request('http://localhost/api/console/0g');
    const response = await consoleGET(request);
    const body = await response.json();

    expect(body.merchant.id).toBe('merchant_test_123');
  });

  it('includes stats section with correct shape', async () => {
    mockIsSealedInferenceEnabled.mockReturnValue(false);

    const request = new Request('http://localhost/api/console/0g');
    const response = await consoleGET(request);
    const body = await response.json();

    expect(body.stats).toBeDefined();
    expect(typeof body.stats.receiptsStored).toBe('number');
    expect(typeof body.stats.receiptsAnchored).toBe('number');
    expect(typeof body.stats.profilePublished).toBe('boolean');
    expect(typeof body.stats.memoryPublished).toBe('boolean');
    expect(typeof body.stats.paywallManifests).toBe('number');
    expect(typeof body.stats.aiQueries).toBe('number');
    expect(typeof body.stats.sealedQueries).toBe('number');
    expect(typeof body.stats.confirmedPayments).toBe('number');
  });

  it('reports overall status as ok when all checks pass', async () => {
    mockIsSealedInferenceEnabled.mockReturnValue(false);

    const request = new Request('http://localhost/api/console/0g');
    const response = await consoleGET(request);
    const body = await response.json();

    expect(body.status).toBe('ok');
  });

  it('reports overall status as degraded when a check fails', async () => {
    mockIsSealedInferenceEnabled.mockReturnValue(false);
    mockCheckStorageHealth.mockRejectedValue(new Error('Storage unavailable'));

    const request = new Request('http://localhost/api/console/0g');
    const response = await consoleGET(request);
    const body = await response.json();

    expect(body.status).toBe('degraded');
    expect(body.checks.storage.ok).toBe(false);
  });
});

// ─── /api/0g/health disabled state ────────────────────────────────────────────

describe('GET /api/0g/health (0G disabled)', () => {
  let disabledHealthGET: typeof import('@/app/api/0g/health/route').GET;

  beforeAll(async () => {
    vi.resetModules();

    vi.doMock('@/lib/0g/env', () => ({
      zeroGEnv: {
        enabled: false,
        computeEnabled: false,
        computeBaseUrl: '',
        computeApiKey: '',
        storageTargetMbps: 200,
      },
    }));

    // Re-mock dependencies after resetModules
    vi.doMock('@/lib/0g/storage', () => ({
      checkStorageHealth: mockCheckStorageHealth,
      getStoragePerformancePlaybook: mockGetStoragePerformancePlaybook,
    }));
    vi.doMock('@/lib/0g/chain', () => ({
      checkZeroGChainHealth: mockCheckZeroGChainHealth,
    }));
    vi.doMock('@/lib/0g/compute', () => ({
      listComputeServices: mockListComputeServices,
      isSealedInferenceEnabled: mockIsSealedInferenceEnabled,
    }));
    vi.doMock('@/lib/0g/da', () => ({
      checkDAHealth: mockCheckDAHealth,
    }));

    ({ GET: disabledHealthGET } = await import('@/app/api/0g/health/route'));
  });

  it('returns disabled status when 0G is not enabled', async () => {
    const response = await disabledHealthGET(new Request('http://localhost/api/0g/health'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('disabled');
    expect(body.checks.zeroG.ok).toBe(false);
    expect(body.checks.zeroG.reason).toContain('false');
  });
});
