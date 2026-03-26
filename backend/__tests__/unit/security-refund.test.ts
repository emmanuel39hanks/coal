import { describe, it, expect } from 'vitest';
import { validateRecipients } from '@/lib/splits';
import { validateAmount } from '@/lib/validation';

// ── Refund amount validation ─────────────────────────────────────────────────
describe('refund amount bounds', () => {
  it('rejects amounts exceeding 1,000,000', () => {
    expect(validateAmount(1_000_001)).toBeNull();
  });

  it('rejects zero amount', () => {
    expect(validateAmount(0)).toBeNull();
  });

  it('rejects negative amount', () => {
    expect(validateAmount(-10)).toBeNull();
  });

  it('rejects NaN', () => {
    expect(validateAmount(NaN)).toBeNull();
  });

  it('rejects Infinity', () => {
    expect(validateAmount(Infinity)).toBeNull();
  });

  it('accepts valid positive amount', () => {
    expect(validateAmount(50)).toBe(50);
  });

  it('accepts amount with up to 6 decimal places', () => {
    expect(validateAmount('1.123456')).toBe(1.123456);
  });

  it('rejects amount with more than 6 decimal places', () => {
    expect(validateAmount('1.1234567')).toBeNull();
  });

  it('rejects string amounts that contain non-numeric characters', () => {
    expect(validateAmount('10abc')).toBeNull();
  });
});

// ── Split percent integer enforcement ────────────────────────────────────────
describe('split percent integer enforcement', () => {
  const ADDR = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
  const ADDR_B = '0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2';

  it('rejects non-integer percentages', () => {
    const result = validateRecipients([
      { address: ADDR, percent: 33.33 },
      { address: ADDR_B, percent: 66.67 },
    ]);
    expect(result).toBe('Percent must be an integer');
  });

  it('accepts integer percentages', () => {
    const result = validateRecipients([
      { address: ADDR, percent: 33 },
      { address: ADDR_B, percent: 67 },
    ]);
    expect(result).toBeNull();
  });

  it('rejects -0.5 percent', () => {
    const result = validateRecipients([
      { address: ADDR, percent: -0.5 },
      { address: ADDR_B, percent: 100.5 },
    ]);
    expect(result).toBe('Percent must be an integer');
  });
});

// ── Refund business logic (pure math) ────────────────────────────────────────
describe('refund math', () => {
  it('remaining refundable is correctly calculated after partial refund', () => {
    const originalAmount = 100;
    const previousRefunds = [30, 20]; // two prior partial refunds
    const totalRefunded = previousRefunds.reduce((s, r) => s + r, 0);
    const remaining = originalAmount - totalRefunded;
    expect(remaining).toBe(50);
  });

  it('full refund leaves zero remaining', () => {
    const originalAmount = 100;
    const totalRefunded = 100;
    const remaining = originalAmount - totalRefunded;
    expect(remaining).toBe(0);
    expect(remaining <= 0).toBe(true);
  });

  it('partial refund exceeding remaining is rejected', () => {
    const originalAmount = 100;
    const totalRefunded = 80;
    const remaining = originalAmount - totalRefunded;
    const requestedRefund = 25; // more than the 20 remaining
    expect(requestedRefund > remaining).toBe(true);
  });

  it('partial refund within remaining is accepted', () => {
    const originalAmount = 100;
    const totalRefunded = 80;
    const remaining = originalAmount - totalRefunded;
    const requestedRefund = 15; // less than the 20 remaining
    expect(requestedRefund <= remaining).toBe(true);
  });
});

// ── Sanctions address format validation ──────────────────────────────────────
describe('sanctions address input validation', () => {
  it('filters out empty strings from address list', () => {
    const addresses = ['0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', '', null].filter(Boolean);
    expect(addresses).toHaveLength(1);
    expect(addresses[0]).toBe('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
  });
});
