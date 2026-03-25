import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

vi.mock('@/lib/logger', () => ({
  zeroGLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/0g/storage', () => ({
  stableJsonStringify: vi.fn((value: unknown) => JSON.stringify(value)),
  sha256Hex: vi.fn((value: string) => `0x${createHash('sha256').update(value).digest('hex')}`),
}));

const originalEnv = { ...process.env };

let buildDAEvent: typeof import('@/lib/0g/da').buildDAEvent;
let postDAEvent: typeof import('@/lib/0g/da').postDAEvent;
let isDAEnabled: typeof import('@/lib/0g/da').isDAEnabled;
let getDAConfig: typeof import('@/lib/0g/da').getDAConfig;
let checkDAHealth: typeof import('@/lib/0g/da').checkDAHealth;

describe('DA events', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // DA is disabled by default unless explicitly enabled
    delete process.env.ZERO_G_DA_ENABLED;
    delete process.env.ZERO_G_ENABLED;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ─── buildDAEvent structure and hashing ─────────────────────────────────

  describe('buildDAEvent', () => {
    beforeEach(async () => {
      // Re-mock env with DA flags for buildDAEvent tests
      vi.doMock('@/lib/0g/env', () => ({
        zeroGEnv: {
          enabled: true,
          daEnabled: true,
        },
      }));

      ({ buildDAEvent } = await import('@/lib/0g/da'));
    });

    it('returns the coal.da_event.v1 version tag', () => {
      const event = buildDAEvent('payment_confirmed', 'merchant_123', { txHash: '0xabc' });

      expect(event.version).toBe('coal.da_event.v1');
    });

    it('includes the correct kind and merchantId', () => {
      const event = buildDAEvent('subscription_renewed', 'merchant_456', { subId: 'sub_1' });

      expect(event.kind).toBe('subscription_renewed');
      expect(event.merchantId).toBe('merchant_456');
    });

    it('includes an ISO timestamp', () => {
      const event = buildDAEvent('payment_confirmed', 'merchant_123', {});

      expect(event.timestamp).toBeTruthy();
      const parsed = new Date(event.timestamp);
      expect(parsed.getTime()).not.toBeNaN();
    });

    it('includes the payload verbatim', () => {
      const payload = { txHash: '0xabc', amount: '49.99', currency: 'USDC' };
      const event = buildDAEvent('payment_confirmed', 'merchant_123', payload);

      expect(event.payload).toEqual(payload);
    });

    it('computes payloadHash as a 0x-prefixed SHA256 hex', () => {
      const payload = { txHash: '0xdef' };
      const event = buildDAEvent('payment_confirmed', 'merchant_123', payload);

      expect(event.payloadHash).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it('produces deterministic payloadHash for identical payloads', () => {
      const payload = { a: 1, b: 2 };
      const event1 = buildDAEvent('payment_confirmed', 'm1', payload);
      const event2 = buildDAEvent('payment_confirmed', 'm1', payload);

      expect(event1.payloadHash).toBe(event2.payloadHash);
    });

    it('produces different payloadHash for different payloads', () => {
      const event1 = buildDAEvent('payment_confirmed', 'm1', { a: 1 });
      const event2 = buildDAEvent('payment_confirmed', 'm1', { a: 2 });

      expect(event1.payloadHash).not.toBe(event2.payloadHash);
    });

    it('supports all valid event kinds', () => {
      const kinds = [
        'payment_confirmed',
        'subscription_renewed',
        'subscription_created',
        'webhook_delivered',
        'paywall_access_granted',
        'receipt_anchored',
      ] as const;

      for (const kind of kinds) {
        const event = buildDAEvent(kind, 'merchant_1', { test: true });
        expect(event.kind).toBe(kind);
        expect(event.version).toBe('coal.da_event.v1');
      }
    });

    it('handles empty payload', () => {
      const event = buildDAEvent('payment_confirmed', 'merchant_123', {});

      expect(event.payload).toEqual({});
      expect(event.payloadHash).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it('handles nested payload objects', () => {
      const payload = {
        transaction: { hash: '0x123', from: '0xaaa', to: '0xbbb' },
        metadata: { items: [{ id: 1 }, { id: 2 }] },
      };
      const event = buildDAEvent('payment_confirmed', 'merchant_123', payload);

      expect(event.payload).toEqual(payload);
      expect(event.payloadHash).toMatch(/^0x[a-f0-9]{64}$/);
    });
  });

  // ─── postDAEvent when disabled ──────────────────────────────────────────

  describe('postDAEvent when DA is disabled', () => {
    beforeEach(async () => {
      vi.doMock('@/lib/0g/env', () => ({
        zeroGEnv: {
          enabled: false,
          daEnabled: false,
        },
      }));

      ({ postDAEvent, isDAEnabled } = await import('@/lib/0g/da'));
    });

    it('returns null immediately when DA is disabled', async () => {
      const result = await postDAEvent('payment_confirmed', 'merchant_123', { txHash: '0xabc' });
      expect(result).toBeNull();
    });

    it('reports DA as disabled via isDAEnabled', () => {
      expect(isDAEnabled()).toBe(false);
    });
  });

  // ─── postDAEvent when enabled=true but DA_ENABLED=false ─────────────────

  describe('postDAEvent when 0G enabled but DA flag off', () => {
    beforeEach(async () => {
      vi.doMock('@/lib/0g/env', () => ({
        zeroGEnv: {
          enabled: true,
          daEnabled: false,
        },
      }));

      ({ postDAEvent, isDAEnabled } = await import('@/lib/0g/da'));
    });

    it('returns null because isDAEnabled requires both flags', async () => {
      const result = await postDAEvent('payment_confirmed', 'merchant_123', { txHash: '0xabc' });
      expect(result).toBeNull();
    });
  });

  // ─── getDAConfig ────────────────────────────────────────────────────────

  describe('getDAConfig', () => {
    beforeEach(async () => {
      vi.doMock('@/lib/0g/env', () => ({
        zeroGEnv: {
          enabled: false,
          daEnabled: false,
        },
      }));

      ({ getDAConfig } = await import('@/lib/0g/da'));
    });

    it('returns config with enabled false when DA is disabled', () => {
      const config = getDAConfig();

      expect(config.enabled).toBe(false);
      expect(config.grpcUrl).toBeTruthy();
      expect(typeof config.timeoutMs).toBe('number');
      expect(config.timeoutMs).toBeGreaterThan(0);
    });
  });

  // ─── checkDAHealth when disabled ────────────────────────────────────────

  describe('checkDAHealth when disabled', () => {
    beforeEach(async () => {
      vi.doMock('@/lib/0g/env', () => ({
        zeroGEnv: {
          enabled: false,
          daEnabled: false,
        },
      }));

      ({ checkDAHealth } = await import('@/lib/0g/da'));
    });

    it('returns disabled status without attempting connection', async () => {
      const health = await checkDAHealth();

      expect(health.enabled).toBe(false);
      expect(health.configured).toBe(false);
      expect(health.connected).toBe(false);
      expect(health.grpcUrl).toBeTruthy();
      expect(health.error).toBeUndefined();
    });
  });
});
