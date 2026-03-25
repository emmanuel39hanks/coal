import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// ── Mock prisma before importing the module under test ─────────────────────
const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    apiKey: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

import { validateApiKey } from '@/lib/api-auth';

// ── Helpers ────────────────────────────────────────────────────────────────

function hashKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function fakeRequest(headers: Record<string, string> = {}): Request {
  return new Request('https://api.coal.dev/v1/checkout', { headers });
}

const VALID_RAW_KEY = 'coal_live_abc123def456ghi789';

function fakeKeyRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ck9z8x7w6v5u4t3s2r1q',
    secretHash: hashKey(VALID_RAW_KEY),
    prefix: 'coal_live_abc1',
    label: 'Production key',
    merchantId: 'usr1a2b3c4d5e6f7g8h9i',
    revokedAt: null,
    lastUsed: null,
    createdAt: new Date('2025-01-01'),
    merchant: {
      id: 'usr1a2b3c4d5e6f7g8h9i',
      email: 'merchant@example.com',
      name: 'Test Merchant',
    },
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockFindFirst.mockReset();
  mockUpdate.mockReset();
  // Default: update succeeds silently (fire-and-forget lastUsed)
  mockUpdate.mockResolvedValue({});
});

describe('validateApiKey', () => {
  // ── Missing / absent key ──────────────────────────────────────────────

  it('returns null when x-api-key header is missing', async () => {
    const result = await validateApiKey(fakeRequest());
    expect(result).toBeNull();
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it('returns null when x-api-key header is empty string', async () => {
    const result = await validateApiKey(fakeRequest({ 'x-api-key': '' }));
    // Empty string is falsy, so should return null
    expect(result).toBeNull();
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  // ── Valid key lookup ──────────────────────────────────────────────────

  it('returns the key record with merchant when key is valid', async () => {
    const record = fakeKeyRecord();
    mockFindFirst.mockResolvedValue(record);

    const result = await validateApiKey(
      fakeRequest({ 'x-api-key': VALID_RAW_KEY })
    );

    expect(result).toEqual(record);
    expect(result?.merchant).toBeDefined();
    expect(result?.merchant.id).toBe('usr1a2b3c4d5e6f7g8h9i');
  });

  it('hashes the key with SHA-256 before querying', async () => {
    mockFindFirst.mockResolvedValue(null);

    await validateApiKey(fakeRequest({ 'x-api-key': VALID_RAW_KEY }));

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          secretHash: hashKey(VALID_RAW_KEY),
        }),
      })
    );
  });

  it('only matches non-revoked keys (revokedAt: null)', async () => {
    mockFindFirst.mockResolvedValue(null);

    await validateApiKey(fakeRequest({ 'x-api-key': VALID_RAW_KEY }));

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          revokedAt: null,
        }),
      })
    );
  });

  it('includes merchant relation in query', async () => {
    mockFindFirst.mockResolvedValue(null);

    await validateApiKey(fakeRequest({ 'x-api-key': VALID_RAW_KEY }));

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          merchant: true,
        }),
      })
    );
  });

  // ── Invalid key ───────────────────────────────────────────────────────

  it('returns null when key is not found in database', async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await validateApiKey(
      fakeRequest({ 'x-api-key': 'coal_live_invalidkey000000' })
    );

    expect(result).toBeNull();
  });

  // ── lastUsed update behavior ──────────────────────────────────────────

  it('updates lastUsed timestamp when key is found', async () => {
    const record = fakeKeyRecord();
    mockFindFirst.mockResolvedValue(record);

    await validateApiKey(fakeRequest({ 'x-api-key': VALID_RAW_KEY }));

    // Give fire-and-forget a tick to execute
    await new Promise((r) => setTimeout(r, 10));

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: record.id },
        data: expect.objectContaining({
          lastUsed: expect.any(Date),
        }),
      })
    );
  });

  it('does NOT update lastUsed when key is not found', async () => {
    mockFindFirst.mockResolvedValue(null);

    await validateApiKey(
      fakeRequest({ 'x-api-key': 'coal_live_doesnotexist99' })
    );

    await new Promise((r) => setTimeout(r, 10));

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('swallows lastUsed update failures silently', async () => {
    const record = fakeKeyRecord();
    mockFindFirst.mockResolvedValue(record);
    mockUpdate.mockRejectedValue(new Error('DB write timeout'));

    // Should not throw even though update fails
    const result = await validateApiKey(
      fakeRequest({ 'x-api-key': VALID_RAW_KEY })
    );

    expect(result).toEqual(record);
  });

  // ── Security edge cases ───────────────────────────────────────────────

  it('different raw keys produce different hashes (no collisions)', async () => {
    mockFindFirst.mockResolvedValue(null);

    await validateApiKey(fakeRequest({ 'x-api-key': 'key_aaa' }));
    const firstCall = mockFindFirst.mock.calls[0][0].where.secretHash;

    mockFindFirst.mockClear();

    await validateApiKey(fakeRequest({ 'x-api-key': 'key_bbb' }));
    const secondCall = mockFindFirst.mock.calls[0][0].where.secretHash;

    expect(firstCall).not.toBe(secondCall);
  });

  it('handles SQL-injection-style key values safely (hashed before query)', async () => {
    mockFindFirst.mockResolvedValue(null);

    const maliciousKey = "'; DROP TABLE api_keys; --";
    await validateApiKey(fakeRequest({ 'x-api-key': maliciousKey }));

    // The key gets hashed, so it is never passed as raw SQL
    const queriedHash = mockFindFirst.mock.calls[0][0].where.secretHash;
    expect(queriedHash).toBe(hashKey(maliciousKey));
    expect(queriedHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('handles very long key values without error', async () => {
    mockFindFirst.mockResolvedValue(null);

    const longKey = 'a'.repeat(10_000);
    const result = await validateApiKey(
      fakeRequest({ 'x-api-key': longKey })
    );

    expect(result).toBeNull();
    expect(mockFindFirst).toHaveBeenCalled();
  });

  it('handles special characters in key value', async () => {
    mockFindFirst.mockResolvedValue(null);

    const specialKey = 'coal_key!@#$%^&*()+=[]{}|<>?';
    const result = await validateApiKey(
      fakeRequest({ 'x-api-key': specialKey })
    );

    expect(result).toBeNull();
    const queriedHash = mockFindFirst.mock.calls[0][0].where.secretHash;
    expect(queriedHash).toMatch(/^[a-f0-9]{64}$/);
  });

  // ── Database error propagation ────────────────────────────────────────

  it('propagates database errors from findFirst', async () => {
    mockFindFirst.mockRejectedValue(new Error('Connection refused'));

    await expect(
      validateApiKey(fakeRequest({ 'x-api-key': VALID_RAW_KEY }))
    ).rejects.toThrow('Connection refused');
  });
});
