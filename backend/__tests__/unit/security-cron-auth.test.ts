import { describe, it, expect } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

const BACKEND_ROOT = path.resolve(__dirname, '../..');

// We test the cron auth guard pattern in isolation by simulating
// how each route handles the CRON_SECRET check.

function cronAuthGuard(cronSecret: string | undefined, authHeader: string | null): boolean {
  // Returns true if authorized (the FIXED logic)
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return false;
  }
  return true;
}

function brokenCronAuthGuard(cronSecret: string | undefined, authHeader: string | null): boolean {
  // The OLD broken logic — for comparison
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return false;
  }
  return true;
}

describe('Cron auth guard (fixed)', () => {
  it('denies access when CRON_SECRET is undefined', () => {
    expect(cronAuthGuard(undefined, null)).toBe(false);
  });

  it('denies access when CRON_SECRET is empty string', () => {
    expect(cronAuthGuard('', null)).toBe(false);
  });

  it('denies access when CRON_SECRET is set but no auth header provided', () => {
    expect(cronAuthGuard('secret123', null)).toBe(false);
  });

  it('denies access when CRON_SECRET is set but wrong auth header', () => {
    expect(cronAuthGuard('secret123', 'Bearer wrongsecret')).toBe(false);
  });

  it('allows access when CRON_SECRET matches auth header', () => {
    expect(cronAuthGuard('secret123', 'Bearer secret123')).toBe(true);
  });

  it('denies when auth header is the secret without Bearer prefix', () => {
    expect(cronAuthGuard('secret123', 'secret123')).toBe(false);
  });
});

describe('Old broken guard (regression proof)', () => {
  it('BUG: allowed access when CRON_SECRET was undefined', () => {
    expect(brokenCronAuthGuard(undefined, null)).toBe(true);
  });

  it('BUG: allowed access when CRON_SECRET was empty string', () => {
    expect(brokenCronAuthGuard('', null)).toBe(true);
  });
});

// Verify the actual route files use the fixed pattern
describe('Route file pattern verification', () => {
  it('verify-payments uses deny-by-default pattern', async () => {
    const content = await fs.readFile(
      path.join(BACKEND_ROOT, 'app/api/cron/verify-payments/route.ts'),
      'utf-8'
    );
    expect(content).toContain('!cronSecret ||');
    expect(content).not.toMatch(/cronSecret\s*&&\s*authHeader\s*!==/);
  });

  it('process-subscriptions uses deny-by-default pattern', async () => {
    const content = await fs.readFile(
      path.join(BACKEND_ROOT, 'app/api/cron/process-subscriptions/route.ts'),
      'utf-8'
    );
    expect(content).toContain('!cronSecret ||');
    expect(content).not.toMatch(/cronSecret\s*&&\s*authHeader\s*!==/);
  });

  it('retry-webhooks uses deny-by-default pattern', async () => {
    const content = await fs.readFile(
      path.join(BACKEND_ROOT, 'app/api/cron/retry-webhooks/route.ts'),
      'utf-8'
    );
    expect(content).toContain('!cronSecret ||');
    expect(content).not.toMatch(/cronSecret\s*&&\s*authHeader\s*!==/);
  });
});
