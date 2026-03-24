import { describe, expect, it } from 'vitest';
import {
    buildReceiptPayload,
    buildReceiptSubjectHash,
    canonicalJson,
    hashReceiptPayload,
} from '@/lib/receipts/payload';

describe('receipt payload helpers', () => {
    const input = {
        session: {
            id: 'cs_test_123',
            merchantId: 'merchant_123',
            amount: { toString: () => '49.99' },
            currency: 'USDC',
            description: 'Coal x 0G test payment',
            metadata: { b: 2, a: 1 },
            createdAt: new Date('2026-03-23T10:00:00.000Z'),
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

    it('builds a stable receipt payload shape', () => {
        const payload = buildReceiptPayload(input);

        expect(payload.version).toBe('coal.receipt.v1');
        expect(payload.checkoutSessionId).toBe('cs_test_123');
        expect(payload.transaction.hash).toBe(input.transaction.txHash);
        expect(payload.metadata).toEqual({ a: 1, b: 2 });
    });

    it('canonicalizes payload JSON consistently', () => {
        expect(canonicalJson({ b: 2, a: 1 })).toBe(canonicalJson({ a: 1, b: 2 }));
    });

    it('produces deterministic hashes for the same payload', () => {
        const payload = buildReceiptPayload(input);
        expect(hashReceiptPayload(payload)).toBe(hashReceiptPayload(payload));
        expect(buildReceiptSubjectHash({
            merchantId: input.session.merchantId,
            sessionId: input.session.id,
            txHash: input.transaction.txHash,
        })).toMatch(/^0x[a-f0-9]{64}$/);
    });
});
