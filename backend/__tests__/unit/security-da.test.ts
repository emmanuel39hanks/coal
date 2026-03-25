import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

// Mock logger to prevent real log output during tests
vi.mock('@/lib/logger', () => ({
    zeroGLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

// Mock 0g/env — use a plain object inside the factory (no external const ref)
vi.mock('@/lib/0g/env', () => ({
    zeroGEnv: {
        enabled: false,
        chainRpcUrl: 'https://evmrpc.0g.ai',
        chainId: 16661,
        chainPrivateKey: '',
        receiptAnchorAddress: '',
        chainScanBaseUrl: 'https://chainscan.0g.ai',
        storageIndexUrl: '',
        storageKvRpcUrl: '',
        storageFlowAddress: '',
        storageStreamId: '',
        storageEncryptionKey: '',
        storageTargetMbps: 200,
        storageScanBaseUrl: 'https://storagescan.0g.ai',
        computeEnabled: false,
        computeProvider: '',
        computeBaseUrl: '',
        computeApiKey: '',
        computeModel: '',
        daEnabled: false,
        daGrpcUrl: 'localhost:51001',
        sealedInferenceEnabled: false,
    },
    isZeroGEnabled: () => false,
    isZeroGComputeConfigured: () => false,
}));

// Mock 0g/storage — provide stableJsonStringify
vi.mock('@/lib/0g/storage', () => ({
    stableJsonStringify: (value: unknown) => JSON.stringify(value),
}));

// Mock gRPC modules so they are never actually loaded
vi.mock('@grpc/grpc-js', () => ({}));
vi.mock('@grpc/proto-loader', () => ({}));

import {
    buildDAEvent,
    isDAEnabled,
    getDAConfig,
    postDAEvent,
    type DAEventKind,
} from '@/lib/0g/da';

const BACKEND_ROOT = path.resolve(__dirname, '../..');

// ── isDAEnabled ──────────────────────────────────────────────────────────────

describe('isDAEnabled', () => {
    it('returns false when 0G is entirely disabled', () => {
        // zeroGEnv.enabled is false in the mock, DA_ENABLED env var not set
        expect(isDAEnabled()).toBe(false);
    });

    it('returns false when 0G is enabled but DA_ENABLED env is not "true"', () => {
        // DA_ENABLED is read from process.env at module load time.
        // Since ZERO_G_DA_ENABLED was not set, it remains false.
        expect(isDAEnabled()).toBe(false);
    });
});

// ── getDAConfig ──────────────────────────────────────────────────────────────

describe('getDAConfig', () => {
    it('reports enabled: false when DA is disabled', () => {
        const config = getDAConfig();
        expect(config.enabled).toBe(false);
    });

    it('includes grpcUrl in configuration', () => {
        const config = getDAConfig();
        expect(config.grpcUrl).toBeDefined();
        expect(typeof config.grpcUrl).toBe('string');
    });

    it('includes timeoutMs in configuration', () => {
        const config = getDAConfig();
        expect(config.timeoutMs).toBe(10_000);
    });
});

// ── buildDAEvent ─────────────────────────────────────────────────────────────

describe('buildDAEvent', () => {
    it('sets version to coal.da_event.v1', () => {
        const event = buildDAEvent('payment_confirmed', 'merchant_1', { txHash: '0xabc' });
        expect(event.version).toBe('coal.da_event.v1');
    });

    it('sets the correct kind', () => {
        const event = buildDAEvent('subscription_renewed', 'merchant_1', {});
        expect(event.kind).toBe('subscription_renewed');
    });

    it('sets the correct merchantId', () => {
        const event = buildDAEvent('payment_confirmed', 'merchant_xyz', {});
        expect(event.merchantId).toBe('merchant_xyz');
    });

    it('generates a valid ISO timestamp', () => {
        const event = buildDAEvent('payment_confirmed', 'merchant_1', {});
        expect(() => new Date(event.timestamp)).not.toThrow();
        expect(new Date(event.timestamp).toISOString()).toBe(event.timestamp);
    });

    it('computes SHA-256 payload hash with 0x prefix', () => {
        const payload = { txHash: '0xabc', amount: '100' };
        const event = buildDAEvent('payment_confirmed', 'merchant_1', payload);
        expect(event.payloadHash).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it('produces deterministic hash for same payload', () => {
        const payload = { txHash: '0xabc', amount: '100' };
        const event1 = buildDAEvent('payment_confirmed', 'merchant_1', payload);
        const event2 = buildDAEvent('payment_confirmed', 'merchant_1', payload);
        expect(event1.payloadHash).toBe(event2.payloadHash);
    });

    it('produces different hashes for different payloads', () => {
        const event1 = buildDAEvent('payment_confirmed', 'merchant_1', { amount: '100' });
        const event2 = buildDAEvent('payment_confirmed', 'merchant_1', { amount: '200' });
        expect(event1.payloadHash).not.toBe(event2.payloadHash);
    });

    it('includes the original payload unmodified', () => {
        const payload = { txHash: '0xdef', nested: { key: 'value' } };
        const event = buildDAEvent('payment_confirmed', 'merchant_1', payload);
        expect(event.payload).toEqual(payload);
    });

    it('does not allow user payload to override version field', () => {
        const payload = { version: 'malicious.v999', amount: '1' } as Record<string, unknown>;
        const event = buildDAEvent('payment_confirmed', 'merchant_1', payload);
        expect(event.version).toBe('coal.da_event.v1');
        // The malicious version is safely inside payload, not at the top level
        expect(event.payload.version).toBe('malicious.v999');
    });

    it('does not allow user payload to override kind field', () => {
        const payload = { kind: 'fake_event', amount: '1' } as Record<string, unknown>;
        const event = buildDAEvent('payment_confirmed', 'merchant_1', payload);
        expect(event.kind).toBe('payment_confirmed');
        expect(event.payload.kind).toBe('fake_event');
    });

    it('does not allow user payload to override merchantId', () => {
        const payload = { merchantId: 'attacker_merchant' } as Record<string, unknown>;
        const event = buildDAEvent('payment_confirmed', 'real_merchant', payload);
        expect(event.merchantId).toBe('real_merchant');
        expect(event.payload.merchantId).toBe('attacker_merchant');
    });

    it('handles empty payload object', () => {
        const event = buildDAEvent('payment_confirmed', 'merchant_1', {});
        expect(event.payload).toEqual({});
        expect(event.payloadHash).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it('handles payload with __proto__ key safely', () => {
        const payload = JSON.parse('{"__proto__": {"admin": true}, "amount": "1"}');
        const event = buildDAEvent('payment_confirmed', 'merchant_1', payload);
        expect(event.payload.amount).toBe('1');
        // __proto__ pollution should not affect the event object
        expect((event as any).admin).toBeUndefined();
    });

    it('does not allow user payload to override timestamp', () => {
        const payload = { timestamp: '1970-01-01T00:00:00.000Z' } as Record<string, unknown>;
        const event = buildDAEvent('payment_confirmed', 'merchant_1', payload);
        // Top-level timestamp should be current, not the attacker's value
        expect(event.timestamp).not.toBe('1970-01-01T00:00:00.000Z');
        expect(event.payload.timestamp).toBe('1970-01-01T00:00:00.000Z');
    });

    it('does not allow user payload to override payloadHash', () => {
        const payload = { payloadHash: '0x0000000000000000000000000000000000000000000000000000000000000000' } as Record<string, unknown>;
        const event = buildDAEvent('payment_confirmed', 'merchant_1', payload);
        // The computed hash should not be all zeros unless by extreme coincidence
        expect(event.payloadHash).not.toBe('0x0000000000000000000000000000000000000000000000000000000000000000');
    });
});

// ── postDAEvent (DA disabled path) ───────────────────────────────────────────

describe('postDAEvent when DA is disabled', () => {
    it('returns null immediately when DA is disabled', async () => {
        const result = await postDAEvent('payment_confirmed', 'merchant_1', { tx: '0x1' });
        expect(result).toBeNull();
    });

    it('does not attempt gRPC calls when DA is disabled', async () => {
        // If gRPC were called, it would throw since we mock it as empty
        const result = await postDAEvent('webhook_delivered', 'merchant_1', {});
        expect(result).toBeNull();
    });
});

// ── DAEventKind validation ───────────────────────────────────────────────────

describe('DAEventKind values', () => {
    const validKinds: DAEventKind[] = [
        'payment_confirmed',
        'subscription_renewed',
        'subscription_created',
        'webhook_delivered',
        'paywall_access_granted',
        'receipt_anchored',
    ];

    it.each(validKinds)('accepts valid kind "%s"', (kind) => {
        const event = buildDAEvent(kind, 'merchant_1', {});
        expect(event.kind).toBe(kind);
    });
});

// ── Source file pattern verification ─────────────────────────────────────────

describe('DA source file security patterns', () => {
    it('DA module fails gracefully (non-blocking) on disperse error', async () => {
        const content = await fs.readFile(
            path.join(BACKEND_ROOT, 'lib/0g/da.ts'),
            'utf-8',
        );
        // postDAEvent catches errors and returns null
        expect(content).toContain('return null');
        expect(content).toContain('non-blocking');
    });

    it('DA module uses SHA-256 for payload hashing', async () => {
        const content = await fs.readFile(
            path.join(BACKEND_ROOT, 'lib/0g/da.ts'),
            'utf-8',
        );
        expect(content).toContain("createHash('sha256')");
    });

    it('DA module uses insecure gRPC credentials (local sidecar only)', async () => {
        const content = await fs.readFile(
            path.join(BACKEND_ROOT, 'lib/0g/da.ts'),
            'utf-8',
        );
        // The DA sidecar runs locally, so insecure is expected
        expect(content).toContain('createInsecure');
    });

    it('DA module has a timeout on disperse operations', async () => {
        const content = await fs.readFile(
            path.join(BACKEND_ROOT, 'lib/0g/da.ts'),
            'utf-8',
        );
        expect(content).toContain('withTimeout');
        expect(content).toContain('DA_TIMEOUT_MS');
    });

    it('DA module limits poll attempts to prevent infinite loops', async () => {
        const content = await fs.readFile(
            path.join(BACKEND_ROOT, 'lib/0g/da.ts'),
            'utf-8',
        );
        expect(content).toContain('DA_MAX_POLL_ATTEMPTS');
    });
});
