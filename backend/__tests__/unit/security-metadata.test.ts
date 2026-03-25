import { describe, it, expect } from 'vitest';

// Test that user-supplied metadata is namespaced under "custom" key
// and cannot override system fields like billingType, splitConfigId, etc.

describe('Checkout metadata namespacing', () => {
  // Simulate the fixed metadata construction from checkouts/route.ts
  function buildMetadata(
    linkedProduct: Record<string, unknown> | null,
    userMetadata: Record<string, unknown> | undefined,
    splitConfigId?: string,
    payerInfo?: Record<string, unknown>,
  ) {
    return {
      ...(userMetadata ? { custom: userMetadata } : {}),
      productId:          linkedProduct?.id ?? null,
      productName:        linkedProduct?.name ?? null,
      productDescription: linkedProduct?.description ?? null,
      productImage:       linkedProduct?.image ?? null,
      billingType:        linkedProduct?.billingType ?? null,
      billingInterval:    linkedProduct?.billingInterval ?? null,
      billingIntervalCount: linkedProduct?.billingIntervalCount ?? null,
      ...(splitConfigId && { splitConfigId }),
      ...(payerInfo ? { payerInfoConfig: payerInfo } : {}),
    };
  }

  it('user metadata is placed under "custom" key', () => {
    const result = buildMetadata(null, { orderId: '123', note: 'test' });
    expect(result.custom).toEqual({ orderId: '123', note: 'test' });
  });

  it('user metadata CANNOT override billingType', () => {
    const result = buildMetadata(null, {
      billingType: 'subscription',
      subscriptionConsentAccepted: true,
    });
    // billingType at the top level should be null (no linked product)
    expect(result.billingType).toBeNull();
    // The malicious values are safely nested under custom
    expect(result.custom).toEqual({
      billingType: 'subscription',
      subscriptionConsentAccepted: true,
    });
  });

  it('user metadata CANNOT override splitConfigId', () => {
    const result = buildMetadata(null, { splitConfigId: 'attacker_split_id' });
    expect(result.splitConfigId).toBeUndefined();
    expect(result.custom).toEqual({ splitConfigId: 'attacker_split_id' });
  });

  it('user metadata CANNOT override productId', () => {
    const result = buildMetadata(null, { productId: 'other_merchant_product' });
    expect(result.productId).toBeNull();
    expect(result.custom).toEqual({ productId: 'other_merchant_product' });
  });

  it('linked product fields take precedence correctly', () => {
    const product = {
      id: 'prod_1',
      name: 'Real Product',
      billingType: 'one_time',
      billingInterval: null,
      billingIntervalCount: 1,
    };
    const result = buildMetadata(
      product,
      { billingType: 'subscription', productName: 'Fake' },
    );
    expect(result.billingType).toBe('one_time');
    expect(result.productName).toBe('Real Product');
    expect(result.productId).toBe('prod_1');
  });

  it('omits custom key when no user metadata provided', () => {
    const result = buildMetadata(null, undefined);
    expect(result).not.toHaveProperty('custom');
  });

  it('handles empty user metadata object', () => {
    const result = buildMetadata(null, {});
    expect(result.custom).toEqual({});
  });

  it('splitConfigId is included when provided as system field', () => {
    const result = buildMetadata(null, undefined, 'split_123');
    expect(result.splitConfigId).toBe('split_123');
  });
});
