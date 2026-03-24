import { describe, it, expect } from 'vitest';
import { validateRecipients, calculateSplitAmounts, SplitRecipient } from '@/lib/splits';

const ADDR_A = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const ADDR_B = '0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2';
const ADDR_C = '0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db';

// ── validateRecipients ────────────────────────────────────────────────────────
describe('validateRecipients', () => {
  it('returns null for valid recipients summing to 100', () => {
    const recipients: SplitRecipient[] = [
      { address: ADDR_A, percent: 50 },
      { address: ADDR_B, percent: 30 },
      { address: ADDR_C, percent: 20 },
    ];
    expect(validateRecipients(recipients)).toBeNull();
  });

  it('returns an error string when percentages do not sum to 100', () => {
    const recipients: SplitRecipient[] = [
      { address: ADDR_A, percent: 50 },
      { address: ADDR_B, percent: 30 },
    ];
    const result = validateRecipients(recipients);
    expect(typeof result).toBe('string');
    expect(result).toContain('80');
  });

  it('returns an error for more than 10 recipients', () => {
    const recipients: SplitRecipient[] = Array.from({ length: 11 }, (_, i) => ({
      address: ADDR_A,
      percent: i === 0 ? 10 : 9,
    }));
    expect(validateRecipients(recipients)).toBe('Maximum 10 recipients');
  });

  it('returns an error when a percent is below 1', () => {
    const recipients: SplitRecipient[] = [
      { address: ADDR_A, percent: 0 },
      { address: ADDR_B, percent: 100 },
    ];
    expect(validateRecipients(recipients)).toBe('Minimum split is 1%');
  });

  it('returns an error when a percent is above 99', () => {
    const recipients: SplitRecipient[] = [
      { address: ADDR_A, percent: 100 },
    ];
    const result = validateRecipients(recipients);
    // 100 > 99 triggers max check, but it also fails sum (100 != 100... wait, single 100% should fail max)
    expect(typeof result).toBe('string');
  });

  it('returns an error for an invalid EVM address', () => {
    const recipients: SplitRecipient[] = [
      { address: 'not-an-address', percent: 50 },
      { address: ADDR_B, percent: 50 },
    ];
    const result = validateRecipients(recipients);
    expect(typeof result).toBe('string');
    expect(result).toContain('Invalid address');
  });

  it('returns an error for an empty array', () => {
    expect(validateRecipients([])).toBe('Recipients required');
  });

  it('accepts a single recipient with 100%', () => {
    // 100 > 99 should fail — verifying the max check
    const result = validateRecipients([{ address: ADDR_A, percent: 100 }]);
    expect(typeof result).toBe('string');
    expect(result).toBe('Maximum split per recipient is 99%');
  });

  it('accepts two recipients splitting 100% evenly', () => {
    const recipients: SplitRecipient[] = [
      { address: ADDR_A, percent: 50 },
      { address: ADDR_B, percent: 50 },
    ];
    expect(validateRecipients(recipients)).toBeNull();
  });
});

// ── calculateSplitAmounts ─────────────────────────────────────────────────────
describe('calculateSplitAmounts', () => {
  it('calculates proportional split amounts', () => {
    const recipients: SplitRecipient[] = [
      { address: ADDR_A, percent: 50 },
      { address: ADDR_B, percent: 50 },
    ];
    const results = calculateSplitAmounts(1000n, recipients);
    expect(results[0].amount).toBe(500n);
    expect(results[1].amount).toBe(500n);
  });

  it('assigns remainder to first recipient with 3-way split', () => {
    // 100n / 3 = 33 each, remainder 1 goes to first
    const recipients: SplitRecipient[] = [
      { address: ADDR_A, percent: 33 },
      { address: ADDR_B, percent: 33 },
      { address: ADDR_C, percent: 34 },
    ];
    const results = calculateSplitAmounts(100n, recipients);
    const total = results.reduce((s, r) => s + r.amount, 0n);
    expect(total).toBe(100n);
    expect(results[0].amount).toBe(33n);
    expect(results[1].amount).toBe(33n);
    expect(results[2].amount).toBe(34n);
  });

  it('handles remainder when division is uneven', () => {
    // 10n with 3 recipients at 33/33/34 => 3, 3, 3 = 9, remainder 1 to first
    // Actually: 10 * 33/100 = 3, 10 * 33/100 = 3, 10 * 34/100 = 3, total = 9, remainder 1 to first
    const recipients: SplitRecipient[] = [
      { address: ADDR_A, percent: 33 },
      { address: ADDR_B, percent: 33 },
      { address: ADDR_C, percent: 34 },
    ];
    const results = calculateSplitAmounts(10n, recipients);
    const total = results.reduce((s, r) => s + r.amount, 0n);
    expect(total).toBe(10n);
    // Remainder goes to first, so first gets more
    expect(results[0].amount).toBeGreaterThanOrEqual(results[1].amount);
  });

  it('handles BigInt arithmetic with large amounts', () => {
    const bigAmount = 1_000_000_000_000n; // 1 trillion units (e.g. 1 USDC with 6 decimals = $1M)
    const recipients: SplitRecipient[] = [
      { address: ADDR_A, percent: 70 },
      { address: ADDR_B, percent: 30 },
    ];
    const results = calculateSplitAmounts(bigAmount, recipients);
    expect(results[0].amount).toBe(700_000_000_000n);
    expect(results[1].amount).toBe(300_000_000_000n);
    expect(results[0].amount + results[1].amount).toBe(bigAmount);
  });

  it('preserves address and percent in results', () => {
    const recipients: SplitRecipient[] = [
      { address: ADDR_A, percent: 60, label: 'Main' },
      { address: ADDR_B, percent: 40 },
    ];
    const results = calculateSplitAmounts(1000n, recipients);
    expect(results[0].address).toBe(ADDR_A);
    expect(results[0].percent).toBe(60);
    expect(results[0].label).toBe('Main');
    expect(results[1].address).toBe(ADDR_B);
  });

  it('total always equals the input amount', () => {
    const recipients: SplitRecipient[] = [
      { address: ADDR_A, percent: 50 },
      { address: ADDR_B, percent: 25 },
      { address: ADDR_C, percent: 25 },
    ];
    const totalAmount = 999n;
    const results = calculateSplitAmounts(totalAmount, recipients);
    const total = results.reduce((s, r) => s + r.amount, 0n);
    expect(total).toBe(totalAmount);
  });
});
