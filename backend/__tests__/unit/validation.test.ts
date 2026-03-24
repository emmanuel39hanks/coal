import { describe, it, expect } from 'vitest';
import { validateAmount, amountsMatch, validateAddress, amountToRawUnits } from '@/lib/validation';

describe('validateAmount', () => {
  it('returns the number for a valid positive value', () => {
    expect(validateAmount(10)).toBe(10);
    expect(validateAmount(0.5)).toBe(0.5);
    expect(validateAmount(1_000_000)).toBe(1_000_000);
  });

  it('parses a numeric string', () => {
    expect(validateAmount('42')).toBe(42);
    expect(validateAmount('0.123456')).toBe(0.123456);
  });

  it('returns null for zero', () => {
    expect(validateAmount(0)).toBeNull();
    expect(validateAmount('0')).toBeNull();
  });

  it('returns null for negative numbers', () => {
    expect(validateAmount(-1)).toBeNull();
    expect(validateAmount(-0.01)).toBeNull();
  });

  it('returns null for NaN', () => {
    expect(validateAmount(NaN)).toBeNull();
  });

  it('returns null for Infinity', () => {
    expect(validateAmount(Infinity)).toBeNull();
    expect(validateAmount(-Infinity)).toBeNull();
  });

  it('returns null for values exceeding 1,000,000', () => {
    expect(validateAmount(1_000_001)).toBeNull();
    expect(validateAmount(9_999_999)).toBeNull();
  });

  it('returns null for strings with non-numeric characters', () => {
    expect(validateAmount('10abc')).toBeNull();
    expect(validateAmount('abc')).toBeNull();
  });

  it('returns null for more than 6 decimal places', () => {
    expect(validateAmount(1.1234567)).toBeNull();
    expect(validateAmount('1.1234567')).toBeNull();
  });

  it('accepts exactly 6 decimal places', () => {
    expect(validateAmount(1.123456)).toBe(1.123456);
    expect(validateAmount('1.123456')).toBe(1.123456);
  });

  it('returns null for non-string, non-number types', () => {
    expect(validateAmount(null)).toBeNull();
    expect(validateAmount(undefined)).toBeNull();
    expect(validateAmount({})).toBeNull();
    expect(validateAmount([])).toBeNull();
    expect(validateAmount(true)).toBeNull();
  });
});

describe('validateAddress', () => {
  it('returns the address for a valid EVM address', () => {
    const addr = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
    expect(validateAddress(addr)).toBe(addr);
  });

  it('accepts lowercase hex address', () => {
    const addr = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045';
    expect(validateAddress(addr)).toBe(addr);
  });

  it('accepts uppercase hex address', () => {
    const addr = '0xD8DA6BF26964AF9D7EED9E03E53415D37AA96045';
    expect(validateAddress(addr)).toBe(addr);
  });

  it('returns null for an address that is too short', () => {
    expect(validateAddress('0xd8dA6BF26964aF9D7eEd9e03')).toBeNull();
  });

  it('returns null for an address that is too long', () => {
    expect(validateAddress('0xd8dA6BF26964aF9D7eEd9e03e53415D37aA960451234')).toBeNull();
  });

  it('returns null for missing 0x prefix', () => {
    expect(validateAddress('d8dA6BF26964aF9D7eEd9e03E53415D37aA96045')).toBeNull();
  });

  it('returns null for non-hex characters', () => {
    expect(validateAddress('0xGGGGGBF26964aF9D7eEd9e03E53415D37aA96045')).toBeNull();
  });

  it('returns null for non-string values', () => {
    expect(validateAddress(null)).toBeNull();
    expect(validateAddress(undefined)).toBeNull();
    expect(validateAddress(123)).toBeNull();
  });
});

describe('amountsMatch', () => {
  it('matches 1 USDC (6 decimals)', () => {
    expect(amountsMatch(1_000_000n, '1.0', 6)).toBe(true);
  });

  it('matches 1 ETH (18 decimals)', () => {
    expect(amountsMatch(1_000_000_000_000_000_000n, '1.0', 18)).toBe(true);
  });

  it('returns false when amounts differ by 1 unit', () => {
    expect(amountsMatch(1_000_001n, '1.0', 6)).toBe(false);
    expect(amountsMatch(999_999n, '1.0', 6)).toBe(false);
  });

  it('accepts a numeric expectedAmount', () => {
    expect(amountsMatch(1_000_000n, 1.0, 6)).toBe(true);
  });

  it('truncates extra decimals in expectedAmount without error', () => {
    // 1.1234567 truncated to 6 decimals => 1.123456
    expect(amountsMatch(1_123_456n, 1.1234567, 6)).toBe(true);
  });

  it('returns false for a clearly wrong amount', () => {
    expect(amountsMatch(500_000n, '1.0', 6)).toBe(false);
  });

  it('handles zero onChainAmount against non-zero expected', () => {
    expect(amountsMatch(0n, '1.0', 6)).toBe(false);
  });
});

describe('amountToRawUnits', () => {
  it('converts a 6-decimal amount without floating point math', () => {
    expect(amountToRawUnits('1.234567', 6)).toBe(1_234_567n);
    expect(amountToRawUnits('0.000001', 6)).toBe(1n);
  });

  it('supports higher precision settlement tokens', () => {
    expect(amountToRawUnits('1.5', 18)).toBe(1_500_000_000_000_000_000n);
  });

  it('passes bigint values through unchanged', () => {
    expect(amountToRawUnits(123n, 6)).toBe(123n);
  });
});
