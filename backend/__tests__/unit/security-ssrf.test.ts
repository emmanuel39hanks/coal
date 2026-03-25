import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dns/promises before importing the module under test
const mockResolve4 = vi.fn();
const mockResolve6 = vi.fn();

vi.mock('dns/promises', () => ({
  default: {
    resolve4: (...args: unknown[]) => mockResolve4(...args),
    resolve6: (...args: unknown[]) => mockResolve6(...args),
  },
  resolve4: (...args: unknown[]) => mockResolve4(...args),
  resolve6: (...args: unknown[]) => mockResolve6(...args),
}));

import { validateWebhookUrl } from '@/lib/ssrf';

beforeEach(() => {
  mockResolve4.mockReset();
  mockResolve6.mockReset();
  // Default: resolve to a safe public IP
  mockResolve4.mockResolvedValue(['93.184.216.34']);
  mockResolve6.mockResolvedValue([]);
});

describe('validateWebhookUrl', () => {
  // ── Basic protocol checks ───────────────────────────────────────────

  it('allows HTTPS URLs', async () => {
    const result = await validateWebhookUrl('https://example.com/webhook');
    expect(result.valid).toBe(true);
  });

  it('rejects non-HTTP protocols', async () => {
    const result = await validateWebhookUrl('ftp://example.com/webhook');
    expect(result).toEqual({ valid: false, reason: 'Only HTTP/HTTPS URLs allowed' });
  });

  it('rejects invalid URLs', async () => {
    const result = await validateWebhookUrl('not-a-url');
    expect(result).toEqual({ valid: false, reason: 'Invalid URL' });
  });

  // ── String-based hostname blocks ────────────────────────────────────

  it('blocks localhost', async () => {
    const result = await validateWebhookUrl('https://localhost/webhook');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Blocked host');
  });

  it('blocks metadata.google.internal', async () => {
    const result = await validateWebhookUrl('https://metadata.google.internal/');
    expect(result.valid).toBe(false);
  });

  it('blocks 169.254.169.254 as IP literal', async () => {
    const result = await validateWebhookUrl('https://169.254.169.254/');
    expect(result.valid).toBe(false);
  });

  it('blocks 127.x.x.x IP literals', async () => {
    const result = await validateWebhookUrl('https://127.0.0.1/webhook');
    expect(result.valid).toBe(false);
  });

  it('blocks 10.x.x.x IP literals', async () => {
    const result = await validateWebhookUrl('https://10.0.0.1/webhook');
    expect(result.valid).toBe(false);
  });

  it('blocks 192.168.x.x IP literals', async () => {
    const result = await validateWebhookUrl('https://192.168.1.1/webhook');
    expect(result.valid).toBe(false);
  });

  it('blocks 172.16-31.x.x IP literals', async () => {
    const result = await validateWebhookUrl('https://172.16.0.1/webhook');
    expect(result.valid).toBe(false);
  });

  // ── DNS rebinding protection (the key new feature) ──────────────────

  it('blocks domain that resolves to 127.0.0.1 (DNS rebinding)', async () => {
    mockResolve4.mockResolvedValue(['127.0.0.1']);
    const result = await validateWebhookUrl('https://evil.attacker.com/steal');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Hostname resolves to a blocked IP address');
  });

  it('blocks domain that resolves to 169.254.169.254 (cloud metadata)', async () => {
    mockResolve4.mockResolvedValue(['169.254.169.254']);
    const result = await validateWebhookUrl('https://evil.attacker.com/metadata');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Hostname resolves to a blocked IP address');
  });

  it('blocks domain that resolves to 10.x.x.x (private network)', async () => {
    mockResolve4.mockResolvedValue(['10.0.0.5']);
    const result = await validateWebhookUrl('https://internal.company.com/webhook');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Hostname resolves to a blocked IP address');
  });

  it('blocks domain that resolves to 192.168.x.x via DNS', async () => {
    mockResolve4.mockResolvedValue(['192.168.0.1']);
    const result = await validateWebhookUrl('https://home.router.local/callback');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Hostname resolves to a blocked IP address');
  });

  it('blocks domain resolving to IPv6 loopback', async () => {
    mockResolve4.mockResolvedValue([]);
    mockResolve6.mockResolvedValue(['::1']);
    const result = await validateWebhookUrl('https://evil.example.com/');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Hostname resolves to a blocked IP address');
  });

  it('blocks domain resolving to IPv6 private (fc00::)', async () => {
    mockResolve4.mockResolvedValue([]);
    mockResolve6.mockResolvedValue(['fc00::1']);
    const result = await validateWebhookUrl('https://evil.example.com/');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Hostname resolves to a blocked IP address');
  });

  it('allows domain that resolves to public IP', async () => {
    mockResolve4.mockResolvedValue(['93.184.216.34']);
    const result = await validateWebhookUrl('https://example.com/webhook');
    expect(result.valid).toBe(true);
  });

  it('allows domain with multiple IPs if all are public', async () => {
    mockResolve4.mockResolvedValue(['93.184.216.34', '93.184.216.35']);
    const result = await validateWebhookUrl('https://example.com/webhook');
    expect(result.valid).toBe(true);
  });

  it('blocks if ANY resolved IP is private (mixed resolution)', async () => {
    mockResolve4.mockResolvedValue(['93.184.216.34', '10.0.0.1']);
    const result = await validateWebhookUrl('https://sneaky.example.com/');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('Hostname resolves to a blocked IP address');
  });

  // ── IPv6-mapped IPv4 bypass protection ──────────────────────────────

  it('blocks ::ffff:127.0.0.1 (IPv4-mapped loopback)', async () => {
    mockResolve4.mockResolvedValue([]);
    mockResolve6.mockResolvedValue(['::ffff:127.0.0.1']);
    const result = await validateWebhookUrl('https://evil.example.com/');
    expect(result.valid).toBe(false);
  });

  it('blocks ::ffff:10.0.0.1 (IPv4-mapped private)', async () => {
    mockResolve4.mockResolvedValue([]);
    mockResolve6.mockResolvedValue(['::ffff:10.0.0.1']);
    const result = await validateWebhookUrl('https://evil.example.com/');
    expect(result.valid).toBe(false);
  });

  it('blocks ::ffff:169.254.1.1 (IPv4-mapped link-local)', async () => {
    mockResolve4.mockResolvedValue([]);
    mockResolve6.mockResolvedValue(['::ffff:169.254.1.1']);
    const result = await validateWebhookUrl('https://evil.example.com/');
    expect(result.valid).toBe(false);
  });

  // ── URL credential blocking ─────────────────────────────────────────

  it('blocks URLs with embedded credentials', async () => {
    const result = await validateWebhookUrl('https://user:pass@example.com/webhook');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('URLs with credentials not allowed');
  });

  it('blocks URLs with username only', async () => {
    const result = await validateWebhookUrl('https://admin@example.com/webhook');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('URLs with credentials not allowed');
  });

  // ── DNS failure handling ────────────────────────────────────────────

  it('allows URL when DNS resolution fails (domain may not exist yet)', async () => {
    mockResolve4.mockRejectedValue(new Error('ENOTFOUND'));
    mockResolve6.mockRejectedValue(new Error('ENOTFOUND'));
    const result = await validateWebhookUrl('https://future-domain.example.com/webhook');
    expect(result.valid).toBe(true);
  });
});
