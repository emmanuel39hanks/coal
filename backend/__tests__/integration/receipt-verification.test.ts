import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindUnique = vi.fn();
const mockFindFirstArtifact = vi.fn();
const mockFindFirstAnchor = vi.fn();
const mockCheckRateLimit = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    checkoutSession: { findUnique: mockFindUnique },
    storedArtifact: { findFirst: mockFindFirstArtifact },
    chainAnchor: { findFirst: mockFindFirstAnchor },
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  getIP: () => '127.0.0.1',
  checkRateLimit: mockCheckRateLimit,
  rateLimiters: {
    public: { requests: 100, windowMs: 60_000, upstash: null },
  },
}));

vi.mock('@/lib/errors', async () => {
  const { NextResponse } = await import('next/server');
  return {
    apiSuccess: <T>(data: T) => NextResponse.json(data, { status: 200 }),
    errors: {
      notFound: (resource: string) =>
        NextResponse.json(
          { error: { code: 'NOT_FOUND', message: `${resource} not found` } },
          { status: 404 },
        ),
      rateLimited: () =>
        NextResponse.json(
          { error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
          { status: 429 },
        ),
      internal: (message = 'Internal server error') =>
        NextResponse.json(
          { error: { code: 'INTERNAL_ERROR', message } },
          { status: 500 },
        ),
    },
  };
});

vi.mock('@/lib/0g/env', () => ({
  zeroGEnv: {
    storageScanBaseUrl: 'https://storagescan.0g.ai',
    chainScanBaseUrl: 'https://chainscan.0g.ai',
  },
}));

vi.mock('@/lib/chain', () => ({
  EXPLORER_URL: 'https://basescan.org',
}));

let GET: typeof import('@/app/api/receipts/[id]/route').GET;

beforeAll(async () => {
  ({ GET } = await import('@/app/api/receipts/[id]/route'));
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const confirmedSession = {
  id: 'clrzdqjvw0000k6rzconfirm',
  status: 'confirmed',
  amount: { toString: () => '49.99' },
  currency: 'USDC',
  description: 'Test payment',
  txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  createdAt: new Date('2026-03-24T10:00:00.000Z'),
  merchant: { id: 'merchant_123', name: 'Schema Labs' },
};

const storedArtifact = {
  storageUri: '0g://log/0xartifactroot',
  storageRoot: '0xartifactroot',
  storageTxHash: '0xstoragetx',
  payloadHash: '0xpayloadhash',
  createdAt: new Date('2026-03-24T10:01:00.000Z'),
};

const chainAnchor = {
  anchorTxHash: '0xanchortx',
  anchorContract: '0xanchorcontract',
  anchorChainId: 16661,
  payloadHash: '0xpayloadhash',
  createdAt: new Date('2026-03-24T10:02:00.000Z'),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/receipts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ limited: false, headers: {} });
  });

  it('returns full proof trail for a confirmed payment with 0G artifacts', async () => {
    mockFindUnique.mockResolvedValue(confirmedSession);
    mockFindFirstArtifact.mockResolvedValue(storedArtifact);
    mockFindFirstAnchor.mockResolvedValue(chainAnchor);

    const request = new Request('http://localhost/api/receipts/clrzdqjvw0000k6rzconfirm');
    const response = await GET(request, { params: Promise.resolve({ id: 'clrzdqjvw0000k6rzconfirm' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.verified).toBe(true);
    expect(body.status).toBe('confirmed');
    expect(body.checkoutId).toBe('clrzdqjvw0000k6rzconfirm');

    // Merchant info
    expect(body.merchant.name).toBe('Schema Labs');

    // Payment info
    expect(body.payment.amount).toBe('49.99');
    expect(body.payment.currency).toBe('USDC');
    expect(body.payment.txHash).toBe(confirmedSession.txHash);
    expect(body.payment.explorerUrl).toContain('basescan.org');
    expect(body.payment.paidAt).toBe('2026-03-24T10:00:00.000Z');

    // 0G Storage proof
    expect(body.proofTrail.storage).not.toBeNull();
    expect(body.proofTrail.storage.storageUri).toBe('0g://log/0xartifactroot');
    expect(body.proofTrail.storage.storageRoot).toBe('0xartifactroot');
    expect(body.proofTrail.storage.storageTxHash).toBe('0xstoragetx');
    expect(body.proofTrail.storage.payloadHash).toBe('0xpayloadhash');
    expect(body.proofTrail.storage.explorerUrl).toContain('storagescan.0g.ai');
    expect(body.proofTrail.storage.publishedAt).toBe('2026-03-24T10:01:00.000Z');

    // 0G Chain anchor
    expect(body.proofTrail.chain).not.toBeNull();
    expect(body.proofTrail.chain.anchorTxHash).toBe('0xanchortx');
    expect(body.proofTrail.chain.anchorContract).toBe('0xanchorcontract');
    expect(body.proofTrail.chain.anchorChainId).toBe(16661);
    expect(body.proofTrail.chain.explorerUrl).toContain('chainscan.0g.ai');
    expect(body.proofTrail.chain.anchoredAt).toBe('2026-03-24T10:02:00.000Z');
  });

  it('returns confirmed with null storage and anchor when no 0G artifacts exist', async () => {
    mockFindUnique.mockResolvedValue(confirmedSession);
    mockFindFirstArtifact.mockResolvedValue(null);
    mockFindFirstAnchor.mockResolvedValue(null);

    const request = new Request('http://localhost/api/receipts/clrzdqjvw0000k6rzconfirm');
    const response = await GET(request, { params: Promise.resolve({ id: 'clrzdqjvw0000k6rzconfirm' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.verified).toBe(true);
    expect(body.proofTrail.storage).toBeNull();
    expect(body.proofTrail.chain).toBeNull();
  });

  it('returns verified:false for unconfirmed sessions', async () => {
    const pendingSession = {
      ...confirmedSession,
      id: 'clrzdqjvw0000k6rzpending1',
      status: 'pending',
      txHash: null,
    };
    mockFindUnique.mockResolvedValue(pendingSession);

    const request = new Request('http://localhost/api/receipts/clrzdqjvw0000k6rzpending1');
    const response = await GET(request, { params: Promise.resolve({ id: 'clrzdqjvw0000k6rzpending1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.verified).toBe(false);
    expect(body.status).toBe('pending');
    expect(body.proofTrail).toBeNull();
  });

  it('returns verified:false when session is confirmed but txHash is null', async () => {
    const noTxSession = {
      ...confirmedSession,
      status: 'confirmed',
      txHash: null,
    };
    mockFindUnique.mockResolvedValue(noTxSession);

    const request = new Request('http://localhost/api/receipts/clrzdqjvw0000k6rzconfirm');
    const response = await GET(request, { params: Promise.resolve({ id: 'clrzdqjvw0000k6rzconfirm' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.verified).toBe(false);
    expect(body.proofTrail).toBeNull();
  });

  it('returns 404 when session does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);

    const request = new Request('http://localhost/api/receipts/clrzdqjvw0000k6rznotfound');
    const response = await GET(request, { params: Promise.resolve({ id: 'clrzdqjvw0000k6rznotfound' }) });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('returns 429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({ limited: true, headers: {} });

    const request = new Request('http://localhost/api/receipts/clrzdqjvw0000k6rztestrate');
    const response = await GET(request, { params: Promise.resolve({ id: 'clrzdqjvw0000k6rztestrate' }) });

    expect(response.status).toBe(429);
  });

  it('returns confirmed with storage but no chain anchor', async () => {
    mockFindUnique.mockResolvedValue(confirmedSession);
    mockFindFirstArtifact.mockResolvedValue(storedArtifact);
    mockFindFirstAnchor.mockResolvedValue(null);

    const request = new Request('http://localhost/api/receipts/clrzdqjvw0000k6rzconfirm');
    const response = await GET(request, { params: Promise.resolve({ id: 'clrzdqjvw0000k6rzconfirm' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.verified).toBe(true);
    expect(body.proofTrail.storage).not.toBeNull();
    expect(body.proofTrail.chain).toBeNull();
  });

  it('returns confirmed with chain anchor but no storage artifact', async () => {
    mockFindUnique.mockResolvedValue(confirmedSession);
    mockFindFirstArtifact.mockResolvedValue(null);
    mockFindFirstAnchor.mockResolvedValue(chainAnchor);

    const request = new Request('http://localhost/api/receipts/clrzdqjvw0000k6rzconfirm');
    const response = await GET(request, { params: Promise.resolve({ id: 'clrzdqjvw0000k6rzconfirm' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.verified).toBe(true);
    expect(body.proofTrail.storage).toBeNull();
    expect(body.proofTrail.chain).not.toBeNull();
  });

  it('queries prisma with correct filters for artifact and anchor', async () => {
    mockFindUnique.mockResolvedValue(confirmedSession);
    mockFindFirstArtifact.mockResolvedValue(null);
    mockFindFirstAnchor.mockResolvedValue(null);

    const request = new Request('http://localhost/api/receipts/clrzdqjvw0000k6rzconfirm');
    await GET(request, { params: Promise.resolve({ id: 'clrzdqjvw0000k6rzconfirm' }) });

    // Verify artifact query shape
    expect(mockFindFirstArtifact).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          kind: 'receipt_payload',
          localEntityType: 'checkout_session',
          localEntityId: 'clrzdqjvw0000k6rzconfirm',
          layer: 'log',
          status: 'published',
        }),
      }),
    );

    // Verify anchor query shape
    expect(mockFindFirstAnchor).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          kind: 'receipt',
          localEntityType: 'checkout_session',
          localEntityId: 'clrzdqjvw0000k6rzconfirm',
        }),
      }),
    );
  });

  it('does not query artifacts or anchors for non-confirmed sessions', async () => {
    const pendingSession = {
      ...confirmedSession,
      status: 'pending',
      txHash: null,
    };
    mockFindUnique.mockResolvedValue(pendingSession);

    const request = new Request('http://localhost/api/receipts/clrzdqjvw0000k6rzpendingx');
    await GET(request, { params: Promise.resolve({ id: 'clrzdqjvw0000k6rzpendingx' }) });

    expect(mockFindFirstArtifact).not.toHaveBeenCalled();
    expect(mockFindFirstAnchor).not.toHaveBeenCalled();
  });

  it('returns storage explorerUrl as null when storageRoot is missing', async () => {
    const artifactNoRoot = {
      ...storedArtifact,
      storageRoot: null,
    };
    mockFindUnique.mockResolvedValue(confirmedSession);
    mockFindFirstArtifact.mockResolvedValue(artifactNoRoot);
    mockFindFirstAnchor.mockResolvedValue(null);

    const request = new Request('http://localhost/api/receipts/clrzdqjvw0000k6rzconfirm');
    const response = await GET(request, { params: Promise.resolve({ id: 'clrzdqjvw0000k6rzconfirm' }) });
    const body = await response.json();

    expect(body.proofTrail.storage.explorerUrl).toBeNull();
  });
});
