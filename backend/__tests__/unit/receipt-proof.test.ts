import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildReceiptPayload, buildReceiptSubjectHash, hashReceiptPayload, normalizeArtifactRoot } from '@/lib/receipts/payload';

const mockPublishJson = vi.fn();
const mockAnchorReceipt = vi.fn();
const mockGetLatestArtifact = vi.fn();
const mockGetLatestAnchor = vi.fn();
const mockStoredArtifactCreate = vi.fn();
const mockChainAnchorCreate = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    storedArtifact: { create: mockStoredArtifactCreate },
    chainAnchor: { create: mockChainAnchorCreate },
  },
}));

vi.mock('@/lib/logger', () => ({
  zeroGLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/0g/catalog', () => ({
  getLatestArtifact: mockGetLatestArtifact,
  getLatestAnchor: mockGetLatestAnchor,
}));

vi.mock('@/lib/0g/env', () => ({
  isZeroGEnabled: () => true,
  isZeroGStorageWriteConfigured: () => true,
  isZeroGChainWriteConfigured: () => true,
}));

vi.mock('@/lib/0g/storage', () => ({
  publishJson: mockPublishJson,
}));

vi.mock('@/lib/0g/chain', () => ({
  anchorReceipt: mockAnchorReceipt,
}));

let publishVerifiedReceiptProof: typeof import('@/lib/receipts/proof').publishVerifiedReceiptProof;

const fixture = {
  session: {
    id: 'cs_test_123',
    merchantId: 'merchant_123',
    amount: { toString: () => '49.99' },
    currency: 'USDC',
    description: 'Coal x 0G test payment',
    metadata: { a: 1, b: 2 },
    createdAt: new Date('2026-03-24T10:00:00.000Z'),
  },
  merchant: {
    id: 'merchant_123',
    name: 'Schema Labs',
    email: 'hello@schemalabs.ai',
    payoutAddress: '0x1234567890123456789012345678901234567890',
  },
  transaction: {
    txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    from: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    to: '0x1234567890123456789012345678901234567890',
    amount: '49.99',
    blockNumber: 123456,
    status: 'confirmed',
  },
};

beforeAll(async () => {
  ({ publishVerifiedReceiptProof } = await import('@/lib/receipts/proof'));
});

describe('publishVerifiedReceiptProof', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reuses the latest identical artifact and anchor instead of republishing', async () => {
    const payload = buildReceiptPayload(fixture);
    const payloadHash = hashReceiptPayload(payload);
    const subjectHash = buildReceiptSubjectHash({
      merchantId: fixture.session.merchantId,
      sessionId: fixture.session.id,
      txHash: fixture.transaction.txHash,
    });

    mockGetLatestArtifact.mockResolvedValue({
      kind: 'receipt_payload',
      layer: 'log',
      payloadHash,
      storageRoot: '0xartifactroot',
      storageTxHash: '0xstoragetx',
      storageUri: '0g://log/0xartifactroot',
      streamId: null,
      kvKey: null,
      metadata: {
        txHash: fixture.transaction.txHash,
      },
      createdAt: new Date('2026-03-24T10:01:00.000Z'),
    });
    mockPublishJson.mockResolvedValue({
      kind: 'receipt_payload',
      layer: 'log',
      payloadHash,
      storageRoot: '0xartifactroot',
      storageTxHash: '0xstoragetx',
      storageUri: '0g://log/0xartifactroot',
      byteSize: 120,
      publishedAt: '2026-03-24T10:01:00.000Z',
    });
    mockGetLatestAnchor.mockResolvedValue({
      payloadHash,
      anchorTxHash: '0xanchortx',
      anchorContract: '0xanchorcontract',
      anchorChainId: 16661,
      createdAt: new Date('2026-03-24T10:02:00.000Z'),
    });

    const result = await publishVerifiedReceiptProof(fixture);

    expect(result.skipped).toBe(false);
    expect(mockPublishJson).not.toHaveBeenCalled();
    expect(mockAnchorReceipt).not.toHaveBeenCalled();
    expect(mockStoredArtifactCreate).not.toHaveBeenCalled();
    expect(mockChainAnchorCreate).not.toHaveBeenCalled();
  });

  it('persists new storage and anchor metadata when publishing a fresh proof', async () => {
    const expectedSubjectHash = buildReceiptSubjectHash({
      merchantId: fixture.session.merchantId,
      sessionId: fixture.session.id,
      txHash: fixture.transaction.txHash,
    });
    const expectedArtifactRoot = normalizeArtifactRoot('0xartifactroot');

    mockGetLatestArtifact.mockResolvedValue(null);
    mockGetLatestAnchor.mockResolvedValue(null);
    mockPublishJson.mockResolvedValue({
      kind: 'receipt_payload',
      layer: 'log',
      payloadHash: '0xpublished',
      storageRoot: '0xartifactroot',
      storageTxHash: '0xstoragetx',
      storageUri: '0g://log/0xartifactroot',
      byteSize: 120,
      publishedAt: '2026-03-24T10:03:00.000Z',
    });
    mockAnchorReceipt.mockResolvedValue({
      kind: 'receipt',
      payloadHash: '0xpublished',
      artifactRoot: expectedArtifactRoot,
      subjectHash: expectedSubjectHash,
      anchorTxHash: '0xanchortx',
      anchorContract: '0xanchorcontract',
      anchorChainId: 16661,
      anchoredAt: '2026-03-24T10:04:00.000Z',
    });

    const result = await publishVerifiedReceiptProof(fixture);

    expect(result.skipped).toBe(false);
    expect(mockPublishJson).toHaveBeenCalledTimes(1);
    expect(mockStoredArtifactCreate).toHaveBeenCalledTimes(1);
    expect(mockChainAnchorCreate).toHaveBeenCalledTimes(1);
    expect(mockChainAnchorCreate.mock.calls[0][0].data.metadata).toMatchObject({
      storageRoot: '0xartifactroot',
      artifactRoot: expectedArtifactRoot,
      subjectHash: expectedSubjectHash,
    });
  });
});
