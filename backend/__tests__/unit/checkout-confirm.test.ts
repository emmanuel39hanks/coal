import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/checkout/confirm/route';

describe('legacy checkout confirm route', () => {
  it('returns a gone response pointing to the new confirm route', async () => {
    const response = await POST(new Request('http://localhost/api/checkout/confirm', {
      method: 'POST',
      body: JSON.stringify({ txHash: '0xabc' }),
      headers: { 'content-type': 'application/json' },
    }));

    expect(response.status).toBe(410);
    const payload = await response.json();
    expect(payload.error.code).toBe('GONE');
    expect(payload.error.message).toContain('/api/pay/confirm');
  });
});
