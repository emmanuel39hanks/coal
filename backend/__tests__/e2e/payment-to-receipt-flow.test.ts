/**
 * E2E flow test: Payment -> Verification -> Receipt
 *
 * Exercises the full lifecycle from a paywall returning 402 with x402 headers,
 * through the cron verifying an on-chain payment, to the receipt endpoint
 * returning a complete proof trail with storage and chain anchors.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock external dependencies ──────────────────────────────────────────────

const mockPaywallFindUnique = vi.fn();
const mockPaywallAccessFindUnique = vi.fn();
const mockPaywallAccessUpsert = vi.fn();
const mockCheckoutSessionFindMany = vi.fn();
const mockCheckoutSessionFindUnique = vi.fn();
const mockCheckoutSessionUpdate = vi.fn();
const mockCheckoutSessionCount = vi.fn();
const mockTransactionUpsert = vi.fn();
const mockStoredArtifactCreate = vi.fn();
const mockStoredArtifactFindFirst = vi.fn();
const mockChainAnchorCreate = vi.fn();
const mockChainAnchorFindFirst = vi.fn();
const mockFundingIntentUpdateMany = vi.fn();
const mockPrismaTransaction = vi.fn();

vi.mock('@/lib/prisma', () => ({
    prisma: {
        paywall: { findUnique: (...args: unknown[]) => mockPaywallFindUnique(...args) },
        paywallAccess: {
            findUnique: (...args: unknown[]) => mockPaywallAccessFindUnique(...args),
            upsert: (...args: unknown[]) => mockPaywallAccessUpsert(...args),
        },
        checkoutSession: {
            findMany: (...args: unknown[]) => mockCheckoutSessionFindMany(...args),
            findUnique: (...args: unknown[]) => mockCheckoutSessionFindUnique(...args),
            update: (...args: unknown[]) => mockCheckoutSessionUpdate(...args),
            count: (...args: unknown[]) => mockCheckoutSessionCount(...args),
        },
        transaction: { upsert: (...args: unknown[]) => mockTransactionUpsert(...args) },
        storedArtifact: {
            create: (...args: unknown[]) => mockStoredArtifactCreate(...args),
            findFirst: (...args: unknown[]) => mockStoredArtifactFindFirst(...args),
        },
        chainAnchor: {
            create: (...args: unknown[]) => mockChainAnchorCreate(...args),
            findFirst: (...args: unknown[]) => mockChainAnchorFindFirst(...args),
        },
        fundingIntent: { updateMany: (...args: unknown[]) => mockFundingIntentUpdateMany(...args) },
        $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
            mockPrismaTransaction(fn),
    },
}));

vi.mock('@/lib/logger', () => ({
    paymentLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    zeroGLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/rate-limit', () => ({
    rateLimiters: { public: { requests: 100, windowMs: 60_000, upstash: null } },
    checkRateLimit: vi.fn().mockResolvedValue({ limited: false, headers: {} }),
    getIP: vi.fn().mockReturnValue('127.0.0.1'),
}));

const mockGetPaywallZeroGState = vi.fn();
vi.mock('@/lib/0g/paywalls', () => ({
    getPaywallZeroGState: (...args: unknown[]) => mockGetPaywallZeroGState(...args),
}));

vi.mock('@/lib/chain', () => ({
    CHAIN_ID: 8453,
    EXPLORER_URL: 'https://basescan.org',
    publicClient: {
        getTransactionReceipt: vi.fn(),
        getBlockNumber: vi.fn().mockResolvedValue(123460n),
    },
    getSettlementToken: () => ({
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
    }),
}));

const mockPublishVerifiedReceiptProof = vi.fn();
vi.mock('@/lib/receipts/proof', () => ({
    publishVerifiedReceiptProof: (...args: unknown[]) => mockPublishVerifiedReceiptProof(...args),
}));

const mockPostDAEvent = vi.fn();
vi.mock('@/lib/0g/da', () => ({
    postDAEvent: (...args: unknown[]) => mockPostDAEvent(...args),
}));

vi.mock('@/lib/0g/env', () => ({
    zeroGEnv: {
        enabled: true,
        storageScanBaseUrl: 'https://storagescan.0g.ai',
        chainScanBaseUrl: 'https://chainscan.0g.ai',
    },
    isZeroGEnabled: () => true,
    isZeroGStorageWriteConfigured: () => true,
    isZeroGChainWriteConfigured: () => true,
}));

vi.mock('@/lib/webhooks', () => ({
    sendWebhook: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/emails/paymentConfirmed', () => ({
    sendPaymentConfirmed: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/subscriptions', () => ({
    markSubscriptionInvoicePastDueBySessionId: vi.fn().mockResolvedValue(undefined),
    syncSubscriptionAfterConfirmedPayment: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/validation', () => ({
    amountsMatch: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/sanctions', () => ({
    checkSanctions: vi.fn().mockResolvedValue({ sanctioned: false }),
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PAYWALL_ID = 'clrzdqjvw0000paywalltest1';
const SESSION_ID = 'clrzdqjvw0000sessiontest1';
const TX_HASH = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const BUYER_ADDRESS = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const MERCHANT = {
    id: 'merchant_test_789',
    name: 'Test Merchant',
    email: 'merchant@test.com',
    payoutAddress: '0x1234567890123456789012345678901234567890',
    webhookUrl: 'https://webhook.test.com/hook',
    webhookSecret: 'whsec_test_secret',
};

const PAYWALL = {
    id: PAYWALL_ID,
    name: 'Premium API Access',
    description: 'Full access to premium endpoints',
    price: { toString: () => '9.99' },
    currency: 'USDC',
    contentType: 'api',
    contentData: '{"key":"secret-content"}',
    contentUrl: 'https://api.example.com/premium',
    pricingModel: 'one_time',
    active: true,
    merchantId: MERCHANT.id,
    merchant: { payoutAddress: MERCHANT.payoutAddress },
};

const PENDING_SESSION = {
    id: SESSION_ID,
    merchantId: MERCHANT.id,
    status: 'verifying',
    pendingTxHash: TX_HASH,
    amount: { toString: () => '9.99' },
    currency: 'USDC',
    description: 'Premium API Access',
    customerEmail: 'customer@test.com',
    customerAddress: BUYER_ADDRESS,
    callbackUrl: null,
    payerInfo: null,
    paymentMode: 'direct',
    metadata: { paywallId: PAYWALL_ID, payerAddress: BUYER_ADDRESS },
    expiresAt: new Date(Date.now() + 3600_000),
    createdAt: new Date('2026-03-25T10:00:00.000Z'),
    product: {
        id: 'prod_test',
        name: 'Premium API',
        description: 'Premium access',
        image: null,
        billingType: 'one_time',
        billingInterval: null,
        billingIntervalCount: null,
    },
    merchant: MERCHANT,
};

// Properly ABI-encoded ERC-20 Transfer log matching viem's decodeEventLog expectations.
// Transfer(address indexed from, address indexed to, uint256 value)
const VALID_TRANSFER_LOG = {
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    data: '0x0000000000000000000000000000000000000000000000000000000000989680',
    topics: [
        '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', // Transfer event sig
        '0x000000000000000000000000bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',   // from (buyer)
        '0x0000000000000000000000001234567890123456789012345678901234567890',   // to (merchant)
    ],
};

function makeSuccessReceipt() {
    return {
        status: 'success',
        blockNumber: 123456n,
        logs: [VALID_TRANSFER_LOG],
    };
}

// ─── Test Suites ─────────────────────────────────────────────────────────────

let GET_verify: typeof import('@/app/api/paywalls/[id]/verify/route').GET;
let POST_cron: typeof import('@/app/api/cron/verify-payments/route').POST;
let GET_receipt: typeof import('@/app/api/receipts/[id]/route').GET;

beforeAll(async () => {
    ({ GET: GET_verify } = await import('@/app/api/paywalls/[id]/verify/route'));
    ({ POST: POST_cron } = await import('@/app/api/cron/verify-payments/route'));
    ({ GET: GET_receipt } = await import('@/app/api/receipts/[id]/route'));
});

describe('Payment-to-Receipt E2E Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = 'test_cron_secret';
        process.env.NEXT_PUBLIC_API_URL = 'https://api.usecoal.xyz';

        mockPrismaTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
            const txProxy = {
                transaction: { upsert: mockTransactionUpsert },
                checkoutSession: {
                    update: mockCheckoutSessionUpdate,
                    findUnique: vi.fn().mockResolvedValue({ status: 'verifying' }),
                },
            };
            return fn(txProxy);
        });
    });

    // ─── Paywall Verify: 402 + x402 headers ──────────────────────────────────

    describe('Step 1: Paywall check returns 402 with x402 headers when unpaid', () => {
        it('returns 402 with x402 payment headers for an unpaid paywall', async () => {
            mockPaywallFindUnique.mockResolvedValue(PAYWALL);
            mockPaywallAccessFindUnique.mockResolvedValue(null);
            mockGetPaywallZeroGState.mockResolvedValue(null);

            const request = new Request(
                `http://localhost/api/paywalls/${PAYWALL_ID}/verify?address=${BUYER_ADDRESS}`,
            );
            const response = await GET_verify(request, {
                params: Promise.resolve({ id: PAYWALL_ID }),
            });

            expect(response.status).toBe(402);

            const xPaymentRequired = response.headers.get('X-Payment-Required');
            expect(xPaymentRequired).toBe('true');

            const xPayment = response.headers.get('X-PAYMENT');
            expect(xPayment).toBeTruthy();

            // Decode x402 payment requirements
            const decoded = JSON.parse(
                Buffer.from(xPayment!, 'base64').toString('utf-8'),
            );
            expect(decoded.scheme).toBe('exact');
            expect(decoded.network).toBe('eip155:8453');
            expect(decoded.maxAmountRequired).toBe('$9.99');
            expect(decoded.payTo).toBe(MERCHANT.payoutAddress);
            expect(decoded.asset).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
            expect(decoded.extra.coalPaywallId).toBe(PAYWALL_ID);
        });

        it('returns CORS-exposed x402 headers so browsers/agents can read them', async () => {
            mockPaywallFindUnique.mockResolvedValue(PAYWALL);
            mockPaywallAccessFindUnique.mockResolvedValue(null);
            mockGetPaywallZeroGState.mockResolvedValue(null);

            const request = new Request(
                `http://localhost/api/paywalls/${PAYWALL_ID}/verify`,
            );
            const response = await GET_verify(request, {
                params: Promise.resolve({ id: PAYWALL_ID }),
            });

            const exposeHeader = response.headers.get('Access-Control-Expose-Headers');
            expect(exposeHeader).toContain('X-PAYMENT');
            expect(exposeHeader).toContain('X-Payment-Required');
        });

        it('includes coal-native and x402 payment methods in 402 body', async () => {
            mockPaywallFindUnique.mockResolvedValue(PAYWALL);
            mockPaywallAccessFindUnique.mockResolvedValue(null);
            mockGetPaywallZeroGState.mockResolvedValue(null);

            const request = new Request(
                `http://localhost/api/paywalls/${PAYWALL_ID}/verify`,
            );
            const response = await GET_verify(request, {
                params: Promise.resolve({ id: PAYWALL_ID }),
            });
            const body = await response.json();

            expect(body.paid).toBe(false);
            expect(body.paymentMethods).toHaveLength(2);
            expect(body.paymentMethods[0].type).toBe('coal-native');
            expect(body.paymentMethods[1].type).toBe('x402');
            expect(body.paymentMethods[1].requirements.scheme).toBe('exact');
        });

        it('returns 200 with content when the address has paid', async () => {
            mockPaywallFindUnique.mockResolvedValue(PAYWALL);
            mockPaywallAccessFindUnique.mockResolvedValue({
                paywallId: PAYWALL_ID,
                address: BUYER_ADDRESS,
                accessCount: 1,
                txHash: TX_HASH,
            });
            mockGetPaywallZeroGState.mockResolvedValue(null);

            const request = new Request(
                `http://localhost/api/paywalls/${PAYWALL_ID}/verify?address=${BUYER_ADDRESS}`,
            );
            const response = await GET_verify(request, {
                params: Promise.resolve({ id: PAYWALL_ID }),
            });

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.paid).toBe(true);
            expect(body.content).toBe('{"key":"secret-content"}');
            expect(body.entitlement.accessCount).toBe(1);
        });

        it('returns 404 for a nonexistent paywall', async () => {
            mockPaywallFindUnique.mockResolvedValue(null);

            const request = new Request(
                'http://localhost/api/paywalls/nonexistent/verify',
            );
            const response = await GET_verify(request, {
                params: Promise.resolve({ id: 'nonexistent' }),
            });

            expect(response.status).toBe(404);
        });
    });

    // ─── Cron: verify-payments confirms and posts DA event ───────────────────

    describe('Step 2: verify-payments cron confirms payment and posts DA event', () => {
        it('rejects requests without valid CRON_SECRET', async () => {
            const request = new Request('http://localhost/api/cron/verify-payments', {
                method: 'POST',
                headers: { authorization: 'Bearer wrong_secret' },
            });
            const response = await POST_cron(request);
            expect(response.status).toBe(401);
        });

        it('returns early when there are no pending sessions', async () => {
            mockCheckoutSessionFindMany.mockResolvedValue([]);

            const request = new Request('http://localhost/api/cron/verify-payments', {
                method: 'POST',
                headers: { authorization: 'Bearer test_cron_secret' },
            });
            const response = await POST_cron(request);
            const body = await response.json();
            expect(body.processed).toBe(0);
        });

        it('confirms a valid on-chain payment and calls publishVerifiedReceiptProof', async () => {
            const { publicClient } = await import('@/lib/chain');
            (publicClient.getTransactionReceipt as ReturnType<typeof vi.fn>).mockResolvedValue(makeSuccessReceipt());
            mockCheckoutSessionFindMany.mockResolvedValue([PENDING_SESSION]);
            mockPublishVerifiedReceiptProof.mockResolvedValue({
                skipped: false,
                payloadHash: '0xreceipt_hash',
                artifact: {
                    storageUri: '0g://log/0xartifactroot',
                    storageRoot: '0xartifactroot',
                    storageTxHash: '0xstoragetx',
                },
                anchor: { anchorTxHash: '0xanchortx' },
            });
            mockTransactionUpsert.mockResolvedValue({});
            mockCheckoutSessionUpdate.mockResolvedValue({});
            mockPaywallAccessUpsert.mockResolvedValue({});
            mockPostDAEvent.mockResolvedValue(null);

            const request = new Request('http://localhost/api/cron/verify-payments', {
                method: 'POST',
                headers: { authorization: 'Bearer test_cron_secret' },
            });
            const response = await POST_cron(request);
            const body = await response.json();

            expect(body.results.confirmed).toBe(1);
            expect(mockPublishVerifiedReceiptProof).toHaveBeenCalledTimes(1);
        });

        it('posts a DA event as fire-and-forget after confirming payment', async () => {
            const { publicClient } = await import('@/lib/chain');
            (publicClient.getTransactionReceipt as ReturnType<typeof vi.fn>).mockResolvedValue(makeSuccessReceipt());
            mockCheckoutSessionFindMany.mockResolvedValue([PENDING_SESSION]);
            mockPublishVerifiedReceiptProof.mockResolvedValue({
                skipped: false,
                artifact: { storageUri: '0g://log/0xroot', storageRoot: '0xroot', storageTxHash: '0xstx' },
                anchor: { anchorTxHash: '0xatx' },
            });
            mockTransactionUpsert.mockResolvedValue({});
            mockCheckoutSessionUpdate.mockResolvedValue({});
            mockPaywallAccessUpsert.mockResolvedValue({});

            const request = new Request('http://localhost/api/cron/verify-payments', {
                method: 'POST',
                headers: { authorization: 'Bearer test_cron_secret' },
            });
            await POST_cron(request);

            // postDAEvent is called via void (fire-and-forget) -- give a tick for the microtask
            await new Promise((r) => setTimeout(r, 10));
            expect(mockPostDAEvent).toHaveBeenCalledWith(
                'payment_confirmed',
                MERCHANT.id,
                expect.objectContaining({
                    checkoutSessionId: SESSION_ID,
                    txHash: TX_HASH,
                    zeroGStorageUri: '0g://log/0xroot',
                    zeroGAnchorTxHash: '0xatx',
                }),
            );
        });

        it('DA event failure does not block payment confirmation', async () => {
            const { publicClient } = await import('@/lib/chain');
            (publicClient.getTransactionReceipt as ReturnType<typeof vi.fn>).mockResolvedValue(makeSuccessReceipt());
            mockCheckoutSessionFindMany.mockResolvedValue([PENDING_SESSION]);
            mockPublishVerifiedReceiptProof.mockResolvedValue({
                skipped: false,
                artifact: { storageUri: '0g://log/0xroot', storageRoot: '0xroot', storageTxHash: '0xstx' },
                anchor: null,
            });
            mockTransactionUpsert.mockResolvedValue({});
            mockCheckoutSessionUpdate.mockResolvedValue({});
            mockPaywallAccessUpsert.mockResolvedValue({});
            // DA event throws -- should not block
            mockPostDAEvent.mockRejectedValue(new Error('DA sidecar unavailable'));

            const request = new Request('http://localhost/api/cron/verify-payments', {
                method: 'POST',
                headers: { authorization: 'Bearer test_cron_secret' },
            });
            const response = await POST_cron(request);
            const body = await response.json();

            expect(body.results.confirmed).toBe(1);
            expect(body.results.failed).toBe(0);
        });
    });

    // ─── Receipt endpoint: full proof trail ──────────────────────────────────

    describe('Step 3: Receipt endpoint returns full proof trail', () => {
        it('returns complete proof trail with storage and chain anchors', async () => {
            mockCheckoutSessionFindUnique.mockResolvedValue({
                id: SESSION_ID,
                status: 'confirmed',
                amount: { toString: () => '9.99' },
                currency: 'USDC',
                description: 'Premium API Access',
                txHash: TX_HASH,
                createdAt: new Date('2026-03-25T10:00:00.000Z'),
                merchant: { id: MERCHANT.id, name: MERCHANT.name },
            });
            mockStoredArtifactFindFirst.mockResolvedValue({
                storageUri: '0g://log/0xartifactroot',
                storageRoot: '0xartifactroot',
                storageTxHash: '0xstoragetx',
                payloadHash: '0xpayloadhash',
                createdAt: new Date('2026-03-25T10:01:00.000Z'),
            });
            mockChainAnchorFindFirst.mockResolvedValue({
                anchorTxHash: '0xanchortx',
                anchorContract: '0xanchorcontract',
                anchorChainId: 16661,
                payloadHash: '0xpayloadhash',
                createdAt: new Date('2026-03-25T10:02:00.000Z'),
            });

            const request = new Request(`http://localhost/api/receipts/${SESSION_ID}`);
            const response = await GET_receipt(request, {
                params: Promise.resolve({ id: SESSION_ID }),
            });

            expect(response.status).toBe(200);
            const body = await response.json();

            expect(body.verified).toBe(true);
            expect(body.status).toBe('confirmed');

            // Payment section
            expect(body.payment.txHash).toBe(TX_HASH);
            expect(body.payment.explorerUrl).toBe(`https://basescan.org/tx/${TX_HASH}`);
            expect(body.payment.amount).toBe('9.99');

            // Storage proof
            expect(body.proofTrail.storage).not.toBeNull();
            expect(body.proofTrail.storage.storageUri).toBe('0g://log/0xartifactroot');
            expect(body.proofTrail.storage.explorerUrl).toBe(
                'https://storagescan.0g.ai/tx/0xstoragetx',
            );

            // Chain anchor proof
            expect(body.proofTrail.chain).not.toBeNull();
            expect(body.proofTrail.chain.anchorTxHash).toBe('0xanchortx');
            expect(body.proofTrail.chain.anchorChainId).toBe(16661);
            expect(body.proofTrail.chain.explorerUrl).toBe(
                'https://chainscan.0g.ai/tx/0xanchortx',
            );
        });

        it('returns verified:false for unconfirmed sessions', async () => {
            mockCheckoutSessionFindUnique.mockResolvedValue({
                id: SESSION_ID,
                status: 'verifying',
                amount: { toString: () => '9.99' },
                currency: 'USDC',
                description: 'Premium API Access',
                txHash: null,
                createdAt: new Date('2026-03-25T10:00:00.000Z'),
                merchant: { id: MERCHANT.id, name: MERCHANT.name },
            });

            const request = new Request(`http://localhost/api/receipts/${SESSION_ID}`);
            const response = await GET_receipt(request, {
                params: Promise.resolve({ id: SESSION_ID }),
            });

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.verified).toBe(false);
            expect(body.proofTrail).toBeNull();
        });

        it('returns null storage/chain when no 0G artifacts exist', async () => {
            mockCheckoutSessionFindUnique.mockResolvedValue({
                id: SESSION_ID,
                status: 'confirmed',
                amount: { toString: () => '9.99' },
                currency: 'USDC',
                description: 'Premium API Access',
                txHash: TX_HASH,
                createdAt: new Date('2026-03-25T10:00:00.000Z'),
                merchant: { id: MERCHANT.id, name: MERCHANT.name },
            });
            mockStoredArtifactFindFirst.mockResolvedValue(null);
            mockChainAnchorFindFirst.mockResolvedValue(null);

            const request = new Request(`http://localhost/api/receipts/${SESSION_ID}`);
            const response = await GET_receipt(request, {
                params: Promise.resolve({ id: SESSION_ID }),
            });

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body.verified).toBe(true);
            expect(body.proofTrail.storage).toBeNull();
            expect(body.proofTrail.chain).toBeNull();
        });

        it('returns 404 for a nonexistent receipt', async () => {
            mockCheckoutSessionFindUnique.mockResolvedValue(null);

            const request = new Request('http://localhost/api/receipts/nonexistent');
            const response = await GET_receipt(request, {
                params: Promise.resolve({ id: 'nonexistent' }),
            });

            expect(response.status).toBe(404);
        });
    });

    // ─── Full lifecycle integration check ────────────────────────────────────

    describe('Full lifecycle: paywall -> payment -> cron -> receipt', () => {
        it('unpaid paywall returns x402 info that matches what receipt shows after payment', async () => {
            // Step 1: Check paywall -- unpaid
            mockPaywallFindUnique.mockResolvedValue(PAYWALL);
            mockPaywallAccessFindUnique.mockResolvedValue(null);
            mockGetPaywallZeroGState.mockResolvedValue(null);

            const verifyRequest = new Request(
                `http://localhost/api/paywalls/${PAYWALL_ID}/verify`,
            );
            const verifyResponse = await GET_verify(verifyRequest, {
                params: Promise.resolve({ id: PAYWALL_ID }),
            });
            expect(verifyResponse.status).toBe(402);

            const verifyBody = await verifyResponse.json();
            const paymentAmount = verifyBody.price;

            // Step 2: Receipt for same session after confirmation
            mockCheckoutSessionFindUnique.mockResolvedValue({
                id: SESSION_ID,
                status: 'confirmed',
                amount: { toString: () => paymentAmount },
                currency: 'USDC',
                description: 'Premium API Access',
                txHash: TX_HASH,
                createdAt: new Date('2026-03-25T10:00:00.000Z'),
                merchant: { id: MERCHANT.id, name: MERCHANT.name },
            });
            mockStoredArtifactFindFirst.mockResolvedValue({
                storageUri: '0g://log/0xartifactroot',
                storageRoot: '0xartifactroot',
                storageTxHash: '0xstoragetx',
                payloadHash: '0xpayloadhash',
                createdAt: new Date('2026-03-25T10:01:00.000Z'),
            });
            mockChainAnchorFindFirst.mockResolvedValue({
                anchorTxHash: '0xanchortx',
                anchorContract: '0xanchorcontract',
                anchorChainId: 16661,
                payloadHash: '0xpayloadhash',
                createdAt: new Date('2026-03-25T10:02:00.000Z'),
            });

            const receiptRequest = new Request(`http://localhost/api/receipts/${SESSION_ID}`);
            const receiptResponse = await GET_receipt(receiptRequest, {
                params: Promise.resolve({ id: SESSION_ID }),
            });
            const receiptBody = await receiptResponse.json();

            // The amount from 402 paywall and the receipt must match
            expect(receiptBody.payment.amount).toBe(paymentAmount);
            expect(receiptBody.verified).toBe(true);
        });
    });
});
