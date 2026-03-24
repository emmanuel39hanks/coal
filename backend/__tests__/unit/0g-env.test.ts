import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  zeroGLogger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const originalEnv = { ...process.env };

describe('0G env defaults', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.ZERO_G_STORAGE_INDEXER_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults storage indexer discovery to the turbo endpoint', async () => {
    const { zeroGEnv } = await import('@/lib/0g/env');

    expect(zeroGEnv.storageIndexUrl).toBe('https://indexer-storage-turbo.0g.ai');
  });
});
