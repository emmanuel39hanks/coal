import { describe, expect, it } from 'vitest';
import {
  normalizePayerInfoConfig,
  normalizePayerInfoValues,
  validatePayerInfo,
} from '@/lib/payer-info';

describe('payer-info helpers', () => {
  it('normalizes payer info config and dedupes fields', () => {
    expect(normalizePayerInfoConfig({
      required: true,
      fields: ['fullName', 'email', 'email'],
    })).toEqual({
      required: true,
      fields: ['fullName', 'email'],
    });
  });

  it('returns null when no fields are configured', () => {
    expect(normalizePayerInfoConfig({ required: true, fields: [] })).toBeNull();
  });

  it('filters empty payer values', () => {
    expect(normalizePayerInfoValues({
      fullName: ' Ada ',
      email: '',
    })).toEqual({
      fullName: 'Ada',
    });
  });

  it('requires configured fields when payer info is required', () => {
    const result = validatePayerInfo(
      { required: true, fields: ['fullName', 'email'] },
      { fullName: 'Ada Lovelace' },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.email).toEqual(['This field is required']);
    }
  });

  it('accepts valid payer info for enabled fields', () => {
    const result = validatePayerInfo(
      { required: true, fields: ['fullName', 'email'] },
      { fullName: 'Ada Lovelace', email: 'ada@example.com' },
    );

    expect(result.ok).toBe(true);
  });
});
