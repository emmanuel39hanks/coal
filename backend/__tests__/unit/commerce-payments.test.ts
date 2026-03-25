import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock viem before importing ─────────────────────────────────────────────
const mockWriteContract = vi.fn();

vi.mock('viem', async () => {
  const actual = await vi.importActual<typeof import('viem')>('viem');
  return {
    ...actual,
    createWalletClient: vi.fn(() => ({
      writeContract: (...args: unknown[]) => mockWriteContract(...args),
    })),
    http: vi.fn(() => 'mocked-transport'),
  };
});

vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn(() => ({
    address: '0xOperator1234567890abcdef1234567890abcdef' as const,
    type: 'local' as const,
  })),
}));

vi.mock('@/lib/chain', () => ({
  CHAIN: { id: 8453, name: 'Base' },
  RPC_URL: 'https://base-mainnet.g.alchemy.com/v2/test',
}));

// Must set env BEFORE importing the module
const FAKE_OPERATOR_KEY =
  '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

import {
  capturePayment,
  voidPayment,
  refundPayment,
  COMMERCE_PAYMENTS_ADDRESS,
  COMMERCE_PAYMENTS_ABI,
  OPERATOR_REFUND_COLLECTOR,
  PERMIT2_PAYMENT_COLLECTOR,
} from '@/lib/commerce-payments';

// ── Helpers ────────────────────────────────────────────────────────────────

const TEST_AUTH_ID =
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`;
const TEST_PAYMENT_ID =
  '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as `0x${string}`;
const TEST_RECIPIENT =
  '0xRecipient234567890abcdef1234567890abcdef' as `0x${string}`;
const TEST_TX_HASH =
  '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' as `0x${string}`;

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockWriteContract.mockReset();
  mockWriteContract.mockResolvedValue(TEST_TX_HASH);
  // Ensure operator key is set
  process.env.COMMERCE_PAYMENTS_OPERATOR_KEY = FAKE_OPERATOR_KEY;
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('contract addresses', () => {
  it('COMMERCE_PAYMENTS_ADDRESS is a valid Ethereum address', () => {
    expect(COMMERCE_PAYMENTS_ADDRESS).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('OPERATOR_REFUND_COLLECTOR is a valid Ethereum address', () => {
    expect(OPERATOR_REFUND_COLLECTOR).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it('PERMIT2_PAYMENT_COLLECTOR is a valid Ethereum address', () => {
    expect(PERMIT2_PAYMENT_COLLECTOR).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
});

describe('COMMERCE_PAYMENTS_ABI', () => {
  it('contains authorize function', () => {
    const names = COMMERCE_PAYMENTS_ABI
      .filter((item) => item.type === 'function')
      .map((item) => (item as { name: string }).name);
    expect(names).toContain('authorize');
  });

  it('contains charge function', () => {
    const names = COMMERCE_PAYMENTS_ABI
      .filter((item) => item.type === 'function')
      .map((item) => (item as { name: string }).name);
    expect(names).toContain('charge');
  });

  it('contains capture, void, and refund functions', () => {
    const names = COMMERCE_PAYMENTS_ABI
      .filter((item) => item.type === 'function')
      .map((item) => (item as { name: string }).name);
    expect(names).toContain('capture');
    expect(names).toContain('void');
    expect(names).toContain('refund');
  });

  it('contains expected events', () => {
    const events = COMMERCE_PAYMENTS_ABI
      .filter((item) => item.type === 'event')
      .map((item) => (item as { name: string }).name);
    expect(events).toContain('Authorized');
    expect(events).toContain('Captured');
    expect(events).toContain('Voided');
    expect(events).toContain('Refunded');
  });
});

describe('capturePayment', () => {
  it('calls writeContract with the correct function and args', async () => {
    const amount = BigInt('1000000'); // 1 USDC
    await capturePayment(TEST_AUTH_ID, amount, TEST_RECIPIENT);

    expect(mockWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: COMMERCE_PAYMENTS_ADDRESS,
        functionName: 'capture',
        args: [TEST_AUTH_ID, amount, TEST_RECIPIENT],
      })
    );
  });

  it('returns the transaction hash on success', async () => {
    const result = await capturePayment(
      TEST_AUTH_ID,
      BigInt('500000'),
      TEST_RECIPIENT
    );

    expect(result).toBe(TEST_TX_HASH);
  });

  it('passes the COMMERCE_PAYMENTS_ABI to writeContract', async () => {
    await capturePayment(TEST_AUTH_ID, BigInt('1'), TEST_RECIPIENT);

    expect(mockWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        abi: COMMERCE_PAYMENTS_ABI,
      })
    );
  });

  it('propagates writeContract errors', async () => {
    mockWriteContract.mockRejectedValue(
      new Error('execution reverted: UNAUTHORIZED')
    );

    await expect(
      capturePayment(TEST_AUTH_ID, BigInt('1'), TEST_RECIPIENT)
    ).rejects.toThrow('execution reverted: UNAUTHORIZED');
  });

  it('throws when COMMERCE_PAYMENTS_OPERATOR_KEY is not set', async () => {
    delete process.env.COMMERCE_PAYMENTS_OPERATOR_KEY;

    await expect(
      capturePayment(TEST_AUTH_ID, BigInt('1'), TEST_RECIPIENT)
    ).rejects.toThrow('COMMERCE_PAYMENTS_OPERATOR_KEY not set');
  });
});

describe('voidPayment', () => {
  it('calls writeContract with void function and authId', async () => {
    await voidPayment(TEST_AUTH_ID);

    expect(mockWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: COMMERCE_PAYMENTS_ADDRESS,
        functionName: 'void',
        args: [TEST_AUTH_ID],
      })
    );
  });

  it('returns the transaction hash on success', async () => {
    const result = await voidPayment(TEST_AUTH_ID);
    expect(result).toBe(TEST_TX_HASH);
  });

  it('propagates contract revert errors', async () => {
    mockWriteContract.mockRejectedValue(
      new Error('execution reverted: AUTH_EXPIRED')
    );

    await expect(voidPayment(TEST_AUTH_ID)).rejects.toThrow(
      'execution reverted: AUTH_EXPIRED'
    );
  });

  it('throws when operator key is missing', async () => {
    delete process.env.COMMERCE_PAYMENTS_OPERATOR_KEY;

    await expect(voidPayment(TEST_AUTH_ID)).rejects.toThrow(
      'COMMERCE_PAYMENTS_OPERATOR_KEY not set'
    );
  });
});

describe('refundPayment', () => {
  it('calls writeContract with refund function and correct args', async () => {
    const refundAmount = BigInt('750000');
    await refundPayment(TEST_PAYMENT_ID, refundAmount, TEST_RECIPIENT);

    expect(mockWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: COMMERCE_PAYMENTS_ADDRESS,
        functionName: 'refund',
        args: [TEST_PAYMENT_ID, refundAmount, TEST_RECIPIENT],
      })
    );
  });

  it('returns the transaction hash on success', async () => {
    const result = await refundPayment(
      TEST_PAYMENT_ID,
      BigInt('100000'),
      TEST_RECIPIENT
    );
    expect(result).toBe(TEST_TX_HASH);
  });

  it('supports partial refund amounts', async () => {
    const fullAmount = BigInt('1000000');
    const partialAmount = BigInt('250000');
    await refundPayment(TEST_PAYMENT_ID, partialAmount, TEST_RECIPIENT);

    const calledAmount = mockWriteContract.mock.calls[0][0].args[1];
    expect(calledAmount).toBe(partialAmount);
    expect(calledAmount).toBeLessThan(fullAmount);
  });

  it('propagates contract revert errors', async () => {
    mockWriteContract.mockRejectedValue(
      new Error('execution reverted: INSUFFICIENT_FUNDS')
    );

    await expect(
      refundPayment(TEST_PAYMENT_ID, BigInt('1'), TEST_RECIPIENT)
    ).rejects.toThrow('execution reverted: INSUFFICIENT_FUNDS');
  });

  it('throws when operator key is missing', async () => {
    delete process.env.COMMERCE_PAYMENTS_OPERATOR_KEY;

    await expect(
      refundPayment(TEST_PAYMENT_ID, BigInt('1'), TEST_RECIPIENT)
    ).rejects.toThrow('COMMERCE_PAYMENTS_OPERATOR_KEY not set');
  });

  it('handles zero refund amount', async () => {
    await refundPayment(TEST_PAYMENT_ID, BigInt(0), TEST_RECIPIENT);

    const calledAmount = mockWriteContract.mock.calls[0][0].args[1];
    expect(calledAmount).toBe(BigInt(0));
  });
});
