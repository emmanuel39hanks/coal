import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
const mockGetLatestArtifact = vi.fn();
const mockPublishJson = vi.fn();
const mockUpsertMutableJson = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    paywall: { findUnique: mockFindUnique },
    storedArtifact: { create: mockCreate },
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
  buildZeroGStreamId: vi.fn(() => '0xmerchant-stream'),
  getLatestArtifact: mockGetLatestArtifact,
}));

vi.mock('@/lib/0g/env', () => ({
  isZeroGEnabled: () => true,
}));

vi.mock('@/lib/0g/storage', () => ({
  publishJson: mockPublishJson,
  upsertMutableJson: mockUpsertMutableJson,
  sha256Hex: vi.fn(() => '0xmanifest-hash'),
  stableJsonStringify: vi.fn((value: unknown) => JSON.stringify(value)),
}));

vi.mock('@/lib/chain', () => ({
  CHAIN_ID: 8453,
  getSettlementToken: () => ({
    address: '0xsettlement',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  }),
}));

let publishPaywallManifest: typeof import('@/lib/0g/paywalls').publishPaywallManifest;

beforeAll(async () => {
  ({ publishPaywallManifest } = await import('@/lib/0g/paywalls'));
});

describe('publishPaywallManifest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue({
      id: 'paywall_123',
      merchantId: 'merchant_123',
      name: 'Premium API',
      description: 'Access',
      price: { toString: () => '49.99' },
      currency: 'USDC',
      contentType: 'api',
      pricingModel: 'one_time',
      active: true,
      contentUrl: 'https://example.com',
      createdAt: new Date('2026-03-24T10:00:00.000Z'),
      updatedAt: new Date('2026-03-24T10:00:00.000Z'),
      merchant: {
        id: 'merchant_123',
        name: 'Schema Labs',
        payoutAddress: '0xmerchant',
      },
    });
  });

  it('skips republishing unchanged manifests', async () => {
    mockGetLatestArtifact.mockImplementation(async ({ kind }: { kind: string }) => {
      if (kind === 'merchant_profile') {
        return null;
      }

      return {
        payloadHash: '0xmanifest-hash',
        storageUri: '0g://log/existing',
        storageRoot: '0xroot',
        storageTxHash: '0xtx',
      };
    });

    const result = await publishPaywallManifest('paywall_123');

    expect(result?.skipped).toBe(true);
    expect(mockPublishJson).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpsertMutableJson).not.toHaveBeenCalled();
  });

  it('publishes new manifests when the payload changes', async () => {
    mockGetLatestArtifact.mockResolvedValue(null);
    mockPublishJson.mockResolvedValue({
      kind: 'paywall_manifest',
      layer: 'log',
      payloadHash: '0xpublished-hash',
      storageRoot: '0xnewroot',
      storageTxHash: '0xnewtx',
      storageUri: '0g://log/new',
      byteSize: 100,
      publishedAt: '2026-03-24T10:05:00.000Z',
    });

    const result = await publishPaywallManifest('paywall_123');

    expect(result?.skipped).toBe(false);
    expect(mockPublishJson).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockUpsertMutableJson).toHaveBeenCalledTimes(1);
  });
});
