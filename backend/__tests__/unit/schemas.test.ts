import { describe, it, expect } from 'vitest';
import {
  evmAddress,
  txHashField,
  amountField,
  createCheckoutSchema,
  confirmPaymentSchema,
  createSessionSchema,
  createProductSchema,
  updateProductSchema,
  createLinkSchema,
  createKeySchema,
  updateSettingsSchema,
  savePayerInfoSchema,
} from '@/lib/schemas';

const VALID_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const VALID_TXHASH = '0x' + 'a'.repeat(64);

// ── evmAddress ────────────────────────────────────────────────────────────────
describe('evmAddress', () => {
  it('accepts a valid EVM address', () => {
    expect(evmAddress.safeParse(VALID_ADDRESS).success).toBe(true);
  });
  it('rejects a short address', () => {
    expect(evmAddress.safeParse('0xabcd').success).toBe(false);
  });
  it('rejects missing 0x prefix', () => {
    expect(evmAddress.safeParse('d8dA6BF26964aF9D7eEd9e03E53415D37aA96045').success).toBe(false);
  });
  it('rejects non-string', () => {
    expect(evmAddress.safeParse(null).success).toBe(false);
  });
});

// ── txHashField ───────────────────────────────────────────────────────────────
describe('txHashField', () => {
  it('accepts a valid 66-char tx hash', () => {
    expect(txHashField.safeParse(VALID_TXHASH).success).toBe(true);
  });
  it('rejects a too-short hash', () => {
    expect(txHashField.safeParse('0xabc').success).toBe(false);
  });
  it('rejects a hash with non-hex characters', () => {
    expect(txHashField.safeParse('0x' + 'Z'.repeat(64)).success).toBe(false);
  });
});

// ── amountField ───────────────────────────────────────────────────────────────
describe('amountField', () => {
  it('accepts a valid positive number', () => {
    expect(amountField.safeParse(10).success).toBe(true);
  });
  it('coerces a numeric string', () => {
    expect(amountField.safeParse('5').success).toBe(true);
  });
  it('rejects zero', () => {
    expect(amountField.safeParse(0).success).toBe(false);
  });
  it('rejects negative numbers', () => {
    expect(amountField.safeParse(-1).success).toBe(false);
  });
  it('rejects values above 1,000,000', () => {
    expect(amountField.safeParse(1_000_001).success).toBe(false);
  });
  it('rejects values with more than 6 decimal places', () => {
    expect(amountField.safeParse(1.1234567).success).toBe(false);
  });
  it('accepts values with exactly 6 decimal places', () => {
    expect(amountField.safeParse(1.123456).success).toBe(true);
  });
  it('rejects non-numeric strings', () => {
    expect(amountField.safeParse('abc').success).toBe(false);
  });
});

// ── createCheckoutSchema ──────────────────────────────────────────────────────
describe('createCheckoutSchema', () => {
  it('accepts minimal valid input', () => {
    expect(createCheckoutSchema.safeParse({ amount: 10 }).success).toBe(true);
  });

  it('defaults currency to USDC', () => {
    const result = createCheckoutSchema.safeParse({ amount: 10 });
    expect(result.success && result.data.currency).toBe('USDC');
  });

  it('accepts USDC currency', () => {
    const result = createCheckoutSchema.safeParse({ amount: 10, currency: 'USDC' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid currency', () => {
    expect(createCheckoutSchema.safeParse({ amount: 10, currency: 'BTC' }).success).toBe(false);
  });

  it('rejects missing amount', () => {
    expect(createCheckoutSchema.safeParse({}).success).toBe(false);
  });

  it('accepts optional fields', () => {
    const input = {
      amount: 99.99,
      productName: 'Widget',
      description: 'A great widget',
      redirectUrl: 'https://example.com/thanks',
      payerInfo: { required: true, fields: ['fullName', 'email'] },
      metadata: { orderId: '123' },
    };
    expect(createCheckoutSchema.safeParse(input).success).toBe(true);
  });

  it('rejects productName exceeding 200 chars', () => {
    expect(createCheckoutSchema.safeParse({ amount: 1, productName: 'x'.repeat(201) }).success).toBe(false);
  });

  it('rejects invalid redirectUrl', () => {
    expect(createCheckoutSchema.safeParse({ amount: 1, redirectUrl: 'not-a-url' }).success).toBe(false);
  });

  it('accepts empty string for redirectUrl', () => {
    expect(createCheckoutSchema.safeParse({ amount: 1, redirectUrl: '' }).success).toBe(true);
  });
});

// ── confirmPaymentSchema ──────────────────────────────────────────────────────
describe('confirmPaymentSchema', () => {
  it('accepts valid sessionId and txHash', () => {
    expect(confirmPaymentSchema.safeParse({ sessionId: 'sess_abc123', txHash: VALID_TXHASH }).success).toBe(true);
  });

  it('rejects missing sessionId', () => {
    expect(confirmPaymentSchema.safeParse({ txHash: VALID_TXHASH }).success).toBe(false);
  });

  it('rejects empty sessionId', () => {
    expect(confirmPaymentSchema.safeParse({ sessionId: '', txHash: VALID_TXHASH }).success).toBe(false);
  });

  it('rejects missing txHash', () => {
    expect(confirmPaymentSchema.safeParse({ sessionId: 'sess_abc123' }).success).toBe(false);
  });

  it('accepts optional signature', () => {
    const result = confirmPaymentSchema.safeParse({
      sessionId: 'sess_abc123',
      txHash: VALID_TXHASH,
      signature: '0xsig',
    });
    expect(result.success).toBe(true);
  });

  it('accepts payerInfo values', () => {
    const result = confirmPaymentSchema.safeParse({
      sessionId: 'sess_abc123',
      txHash: VALID_TXHASH,
      payerInfo: { fullName: 'Ada Lovelace', email: 'ada@example.com' },
    });
    expect(result.success).toBe(true);
  });
});

// ── createSessionSchema ───────────────────────────────────────────────────────
describe('createSessionSchema', () => {
  it('accepts valid linkId', () => {
    expect(createSessionSchema.safeParse({ linkId: 'link_abc' }).success).toBe(true);
  });

  it('rejects empty linkId', () => {
    expect(createSessionSchema.safeParse({ linkId: '' }).success).toBe(false);
  });

  it('accepts optional amount', () => {
    expect(createSessionSchema.safeParse({
      linkId: 'link_abc',
      amount: 50,
      payerInfo: { email: 'ada@example.com' },
    }).success).toBe(true);
  });
});

// ── createProductSchema ───────────────────────────────────────────────────────
describe('createProductSchema', () => {
  it('accepts valid product', () => {
    expect(createProductSchema.safeParse({ name: 'Widget', price: 9.99 }).success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(createProductSchema.safeParse({ name: '', price: 9.99 }).success).toBe(false);
  });

  it('rejects missing price', () => {
    expect(createProductSchema.safeParse({ name: 'Widget' }).success).toBe(false);
  });

  it('rejects name exceeding 200 chars', () => {
    expect(createProductSchema.safeParse({ name: 'x'.repeat(201), price: 1 }).success).toBe(false);
  });
});

// ── updateProductSchema ───────────────────────────────────────────────────────
describe('updateProductSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    expect(updateProductSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a partial update', () => {
    expect(updateProductSchema.safeParse({ price: 19.99 }).success).toBe(true);
  });
});

// ── createLinkSchema ──────────────────────────────────────────────────────────
describe('createLinkSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    expect(createLinkSchema.safeParse({}).success).toBe(true);
  });

  it('accepts valid slug', () => {
    expect(createLinkSchema.safeParse({ slug: 'my-product_1' }).success).toBe(true);
  });

  it('accepts payerInfo config', () => {
    expect(createLinkSchema.safeParse({
      slug: 'my-product_1',
      payerInfo: { required: true, fields: ['fullName', 'email'] },
    }).success).toBe(true);
  });

  it('rejects slug with invalid characters', () => {
    expect(createLinkSchema.safeParse({ slug: 'bad slug!' }).success).toBe(false);
  });

  it('rejects slug exceeding 64 chars', () => {
    expect(createLinkSchema.safeParse({ slug: 'a'.repeat(65) }).success).toBe(false);
  });
});

// ── createKeySchema ───────────────────────────────────────────────────────────
describe('createKeySchema', () => {
  it('accepts empty object', () => {
    expect(createKeySchema.safeParse({}).success).toBe(true);
  });

  it('accepts a name', () => {
    expect(createKeySchema.safeParse({ name: 'My Key' }).success).toBe(true);
  });

  it('rejects name exceeding 100 chars', () => {
    expect(createKeySchema.safeParse({ name: 'x'.repeat(101) }).success).toBe(false);
  });
});

// ── updateSettingsSchema ──────────────────────────────────────────────────────
describe('updateSettingsSchema', () => {
  it('accepts empty object', () => {
    expect(updateSettingsSchema.safeParse({}).success).toBe(true);
  });

  it('accepts valid payoutAddress', () => {
    expect(updateSettingsSchema.safeParse({ payoutAddress: VALID_ADDRESS }).success).toBe(true);
  });

  it('rejects invalid payoutAddress', () => {
    expect(updateSettingsSchema.safeParse({ payoutAddress: 'not-an-address' }).success).toBe(false);
  });

  it('accepts valid webhookUrl', () => {
    expect(updateSettingsSchema.safeParse({ webhookUrl: 'https://hooks.example.com/pay' }).success).toBe(true);
  });

  it('accepts empty string for webhookUrl', () => {
    expect(updateSettingsSchema.safeParse({ webhookUrl: '' }).success).toBe(true);
  });

  it('rejects invalid webhookUrl', () => {
    expect(updateSettingsSchema.safeParse({ webhookUrl: 'not-a-url' }).success).toBe(false);
  });
});

describe('savePayerInfoSchema', () => {
  it('accepts valid payer info payload', () => {
    expect(savePayerInfoSchema.safeParse({
      sessionId: 'sess_abc123',
      payerInfo: {
        fullName: 'Ada Lovelace',
        email: 'ada@example.com',
      },
    }).success).toBe(true);
  });
});
