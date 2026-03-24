import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/webhooks', () => ({ sendWebhook: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

let normalizeRecurringPayerProfile: typeof import('@/lib/subscriptions').normalizeRecurringPayerProfile;

beforeAll(async () => {
  ({ normalizeRecurringPayerProfile } = await import('@/lib/subscriptions'));
});

describe('normalizeRecurringPayerProfile', () => {
  it('restores payer info config and values from recurring metadata', () => {
    const result = normalizeRecurringPayerProfile({
      metadata: {
        payerInfoConfig: {
          required: true,
          fields: ['fullName', 'email', 'company'],
        },
        payerInfoValues: {
          fullName: 'Ada Lovelace',
          company: 'Analytical Engines Ltd',
        },
      },
      customerEmail: 'ada@example.com',
    });

    expect(result).toEqual({
      payerInfoConfig: {
        required: true,
        fields: ['fullName', 'email', 'company'],
      },
      payerInfoValues: {
        fullName: 'Ada Lovelace',
        company: 'Analytical Engines Ltd',
        email: 'ada@example.com',
      },
    });
  });

  it('does not inject email when the checkout did not request it', () => {
    const result = normalizeRecurringPayerProfile({
      metadata: {
        payerInfoConfig: {
          required: true,
          fields: ['fullName', 'company'],
        },
        payerInfoValues: {
          fullName: 'Ada Lovelace',
        },
      },
      customerEmail: 'ada@example.com',
    });

    expect(result).toEqual({
      payerInfoConfig: {
        required: true,
        fields: ['fullName', 'company'],
      },
      payerInfoValues: {
        fullName: 'Ada Lovelace',
      },
    });
  });

  it('returns empty recurring payer data when no config exists', () => {
    const result = normalizeRecurringPayerProfile({
      metadata: {
        payerInfoValues: {
          fullName: 'Ada Lovelace',
        },
      },
      customerEmail: 'ada@example.com',
    });

    expect(result).toEqual({
      payerInfoConfig: null,
      payerInfoValues: null,
    });
  });
});
