import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// ── Mock prisma ────────────────────────────────────────────────────────────
const mockWebhookEventCreate = vi.fn();
const mockWebhookEventUpdate = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    webhookEvent: {
      create: (...args: unknown[]) => mockWebhookEventCreate(...args),
      update: (...args: unknown[]) => mockWebhookEventUpdate(...args),
    },
  },
}));

// ── Mock logger ────────────────────────────────────────────────────────────
vi.mock('@/lib/logger', () => ({
  webhookLogger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// ── Mock fetch ─────────────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { sendWebhook } from '@/lib/webhooks';

// ── Helpers ────────────────────────────────────────────────────────────────

const TEST_URL = 'https://merchant.example.com/webhook';
const TEST_SECRET = 'whsec_testsecrethex1234567890abc';
const TEST_MERCHANT_ID = 'usr1a2b3c4d5e6f7g8h9i';
const TEST_EVENT_ID = 'evt9z8y7x6w5v4u3t2s1';

function okResponse(body = 'OK') {
  return new Response(body, { status: 200, statusText: 'OK' });
}

function errorResponse(status = 500, body = 'Internal Server Error') {
  return new Response(body, { status, statusText: 'Error' });
}

// ── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockFetch.mockReset();
  mockWebhookEventCreate.mockReset();
  mockWebhookEventUpdate.mockReset();

  // Default: event creation succeeds
  mockWebhookEventCreate.mockResolvedValue({ id: TEST_EVENT_ID });
  // Default: event update succeeds
  mockWebhookEventUpdate.mockResolvedValue({});
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('sendWebhook', () => {
  // ── Happy path: successful delivery ───────────────────────────────────

  it('returns true when merchant endpoint responds with 200', async () => {
    mockFetch.mockResolvedValue(okResponse());

    const result = await sendWebhook(
      TEST_URL,
      { event: 'payment.completed', paymentId: 'pay1abc2def3ghi4jkl' },
      TEST_SECRET
    );

    expect(result).toBe(true);
  });

  it('sends POST request to the given URL', async () => {
    mockFetch.mockResolvedValue(okResponse());

    await sendWebhook(TEST_URL, { event: 'payment.completed' }, TEST_SECRET);

    expect(mockFetch).toHaveBeenCalledWith(
      TEST_URL,
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('sends JSON content-type header', async () => {
    mockFetch.mockResolvedValue(okResponse());

    await sendWebhook(TEST_URL, { event: 'payment.completed' }, TEST_SECRET);

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders['Content-Type']).toBe('application/json');
  });

  it('sends Coal-Signature header with timestamp and HMAC', async () => {
    mockFetch.mockResolvedValue(okResponse());

    const payload = { event: 'payment.completed', amount: '10.00' };
    await sendWebhook(TEST_URL, payload, TEST_SECRET);

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    const sig = callHeaders['Coal-Signature'];

    expect(sig).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
  });

  it('produces a valid HMAC signature that can be verified', async () => {
    mockFetch.mockResolvedValue(okResponse());

    const payload = { event: 'payment.completed' };
    await sendWebhook(TEST_URL, payload, TEST_SECRET);

    const body = mockFetch.mock.calls[0][1].body;
    const sig = mockFetch.mock.calls[0][1].headers['Coal-Signature'];

    const [tPart, v1Part] = sig.split(',');
    const timestamp = tPart.replace('t=', '');
    const receivedSig = v1Part.replace('v1=', '');

    // Recompute the HMAC
    const expected = crypto
      .createHmac('sha256', TEST_SECRET)
      .update(`${timestamp}.${body}`)
      .digest('hex');

    expect(receivedSig).toBe(expected);
  });

  it('sends User-Agent header as Coal-Webhook/1.0', async () => {
    mockFetch.mockResolvedValue(okResponse());

    await sendWebhook(TEST_URL, { event: 'test' }, TEST_SECRET);

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders['User-Agent']).toBe('Coal-Webhook/1.0');
  });

  it('serializes payload as JSON in the request body', async () => {
    mockFetch.mockResolvedValue(okResponse());

    const payload = { event: 'payment.completed', data: { id: 'pay123' } };
    await sendWebhook(TEST_URL, payload, TEST_SECRET);

    const body = mockFetch.mock.calls[0][1].body;
    expect(JSON.parse(body)).toEqual(payload);
  });

  // ── Event tracking with merchantId ────────────────────────────────────

  it('creates a webhook event record when merchantId is provided', async () => {
    mockFetch.mockResolvedValue(okResponse());

    await sendWebhook(
      TEST_URL,
      { event: 'payment.completed' },
      TEST_SECRET,
      TEST_MERCHANT_ID
    );

    expect(mockWebhookEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          merchantId: TEST_MERCHANT_ID,
          eventType: 'payment.completed',
          url: TEST_URL,
          status: 'pending',
        }),
      })
    );
  });

  it('does NOT create event record when merchantId is omitted', async () => {
    mockFetch.mockResolvedValue(okResponse());

    await sendWebhook(TEST_URL, { event: 'payment.completed' }, TEST_SECRET);

    expect(mockWebhookEventCreate).not.toHaveBeenCalled();
  });

  it('includes Coal-Event-Id and idempotency headers when event record exists', async () => {
    mockFetch.mockResolvedValue(okResponse());

    await sendWebhook(
      TEST_URL,
      { event: 'payment.completed' },
      TEST_SECRET,
      TEST_MERCHANT_ID
    );

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders['Coal-Event-Id']).toBe(TEST_EVENT_ID);
    expect(callHeaders['Coal-Event-Type']).toBe('payment.completed');
    expect(callHeaders['Coal-Delivery-Attempt']).toBe('1');
    expect(callHeaders['Idempotency-Key']).toBe(TEST_EVENT_ID);
  });

  it('updates event status to delivered on success', async () => {
    mockFetch.mockResolvedValue(okResponse());

    await sendWebhook(
      TEST_URL,
      { event: 'payment.completed' },
      TEST_SECRET,
      TEST_MERCHANT_ID
    );

    expect(mockWebhookEventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_EVENT_ID },
        data: expect.objectContaining({
          status: 'delivered',
          attempts: 1,
          deliveredAt: expect.any(Date),
        }),
      })
    );
  });

  // ── Failed delivery ───────────────────────────────────────────────────

  it('returns false when merchant endpoint responds with 500', async () => {
    mockFetch.mockResolvedValue(errorResponse(500));

    const result = await sendWebhook(
      TEST_URL,
      { event: 'payment.completed' },
      TEST_SECRET
    );

    expect(result).toBe(false);
  });

  it('returns false for 4xx responses', async () => {
    mockFetch.mockResolvedValue(errorResponse(404, 'Not Found'));

    const result = await sendWebhook(
      TEST_URL,
      { event: 'payment.completed' },
      TEST_SECRET
    );

    expect(result).toBe(false);
  });

  it('updates event status to failed with retry time on HTTP error', async () => {
    mockFetch.mockResolvedValue(errorResponse(500));

    await sendWebhook(
      TEST_URL,
      { event: 'payment.completed' },
      TEST_SECRET,
      TEST_MERCHANT_ID
    );

    expect(mockWebhookEventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_EVENT_ID },
        data: expect.objectContaining({
          status: 'failed',
          attempts: 1,
          deliveredAt: null,
          nextRetryAt: expect.any(Date),
        }),
      })
    );
  });

  it('stores truncated response body (max 500 chars) on failure', async () => {
    const longBody = 'X'.repeat(1000);
    mockFetch.mockResolvedValue(errorResponse(500, longBody));

    await sendWebhook(
      TEST_URL,
      { event: 'payment.completed' },
      TEST_SECRET,
      TEST_MERCHANT_ID
    );

    const updateData = mockWebhookEventUpdate.mock.calls[0][0].data;
    expect(updateData.responseBody.length).toBeLessThanOrEqual(500);
    expect(updateData.responseStatus).toBe(500);
  });

  // ── Network errors (fetch throws) ────────────────────────────────────

  it('returns false when fetch throws a network error', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await sendWebhook(
      TEST_URL,
      { event: 'payment.completed' },
      TEST_SECRET
    );

    expect(result).toBe(false);
  });

  it('updates event with error message when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('DNS resolution failed'));

    await sendWebhook(
      TEST_URL,
      { event: 'payment.completed' },
      TEST_SECRET,
      TEST_MERCHANT_ID
    );

    expect(mockWebhookEventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_EVENT_ID },
        data: expect.objectContaining({
          status: 'failed',
          errorMessage: 'DNS resolution failed',
          nextRetryAt: expect.any(Date),
        }),
      })
    );
  });

  it('truncates long error messages to 200 chars', async () => {
    const longMessage = 'Error: ' + 'x'.repeat(500);
    mockFetch.mockRejectedValue(new Error(longMessage));

    await sendWebhook(
      TEST_URL,
      { event: 'payment.completed' },
      TEST_SECRET,
      TEST_MERCHANT_ID
    );

    const updateData = mockWebhookEventUpdate.mock.calls[0][0].data;
    expect(updateData.errorMessage.length).toBeLessThanOrEqual(200);
  });

  // ── Edge cases ────────────────────────────────────────────────────────

  it('uses "unknown" as event type when payload has no event field', async () => {
    mockFetch.mockResolvedValue(okResponse());

    await sendWebhook(
      TEST_URL,
      { data: 'no-event-field' },
      TEST_SECRET,
      TEST_MERCHANT_ID
    );

    expect(mockWebhookEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'unknown',
        }),
      })
    );
  });

  it('still sends the webhook even if event record creation fails', async () => {
    mockWebhookEventCreate.mockRejectedValue(new Error('DB down'));
    mockFetch.mockResolvedValue(okResponse());

    const result = await sendWebhook(
      TEST_URL,
      { event: 'payment.completed' },
      TEST_SECRET,
      TEST_MERCHANT_ID
    );

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalled();
  });

  it('does not include event headers when event creation failed', async () => {
    mockWebhookEventCreate.mockRejectedValue(new Error('DB down'));
    mockFetch.mockResolvedValue(okResponse());

    await sendWebhook(
      TEST_URL,
      { event: 'payment.completed' },
      TEST_SECRET,
      TEST_MERCHANT_ID
    );

    const callHeaders = mockFetch.mock.calls[0][1].headers;
    expect(callHeaders['Coal-Event-Id']).toBeUndefined();
    expect(callHeaders['Idempotency-Key']).toBeUndefined();
  });

  it('applies a 10-second timeout via AbortSignal', async () => {
    mockFetch.mockResolvedValue(okResponse());

    await sendWebhook(TEST_URL, { event: 'test' }, TEST_SECRET);

    const signal = mockFetch.mock.calls[0][1].signal;
    expect(signal).toBeDefined();
  });

  it('does not throw when event update fails after network error', async () => {
    mockFetch.mockRejectedValue(new Error('Timeout'));
    mockWebhookEventUpdate.mockRejectedValue(new Error('DB also down'));

    // Should not throw
    const result = await sendWebhook(
      TEST_URL,
      { event: 'payment.completed' },
      TEST_SECRET,
      TEST_MERCHANT_ID
    );

    expect(result).toBe(false);
  });
});
