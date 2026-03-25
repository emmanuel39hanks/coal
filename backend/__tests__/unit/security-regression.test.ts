import { describe, it, expect } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

// ─── Regression tests ─────────────────────────────────────────────────────────
// These tests scan the actual source files to verify security patterns are
// consistently applied. If a developer adds a new route or removes a guard,
// these tests will catch it.

const BACKEND_ROOT = path.resolve(__dirname, '../..');

async function readFile(relativePath: string): Promise<string> {
  return fs.readFile(path.join(BACKEND_ROOT, relativePath), 'utf-8');
}

async function findRouteFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await fs.readdir(path.join(BACKEND_ROOT, dir), {
    recursive: true,
    withFileTypes: true,
  });
  for (const entry of entries) {
    if (entry.isFile() && entry.name === 'route.ts') {
      const full = path.join(entry.parentPath || entry.path, entry.name);
      results.push(path.relative(BACKEND_ROOT, full));
    }
  }
  return results;
}

// ─── RBAC: All console write endpoints must import a role-check helper ────────

describe('RBAC consistency', () => {
  // These endpoints are exempt from write-access checks:
  // - GET-only routes
  // - team/route.ts (has its own callerRole check)
  // - team/[id]/route.ts (has its own callerMembership check)
  // - team/accept/route.ts (invite acceptance, not a write to merchant data)
  // - workspaces/* (uses getCallerUser + ownerId, not getAuthUser)
  // - onboarding/route.ts (personal onboarding state)
  // - analytics/* (read-only)
  // - export/* (read-only)
  // - 0g/route.ts (publish action)
  const RBAC_EXEMPT = [
    'team/route.ts',
    'team/accept/',
    'team/[id]/route.ts',
    'workspaces/',
    'onboarding/',
    'analytics/',
    'export/',
    '0g/',
    'webhooks/',
    'payments/',
  ];

  it('all console write routes import hasWriteAccess or isWorkspaceOwner', async () => {
    const routeFiles = await findRouteFiles('app/api/console');
    const writeRoutes: string[] = [];

    for (const file of routeFiles) {
      const content = await readFile(file);
      const hasWriteMethod = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)/m.test(content);
      if (!hasWriteMethod) continue;

      const isExempt = RBAC_EXEMPT.some(ex => file.includes(ex));
      if (isExempt) continue;

      const hasRbacImport = content.includes('hasWriteAccess') || content.includes('isWorkspaceOwner');
      if (!hasRbacImport) {
        writeRoutes.push(file);
      }
    }

    expect(writeRoutes).toEqual([]);
  });
});

// ─── SSRF: validateWebhookUrl must be async (DNS resolution) ──────────────────

describe('SSRF protection', () => {
  it('validateWebhookUrl is async (performs DNS resolution)', async () => {
    const content = await readFile('lib/ssrf.ts');
    expect(content).toContain('async function validateWebhookUrl');
    expect(content).toContain('dns.resolve4');
    expect(content).toContain('dns.resolve6');
  });

  it('all callers await validateWebhookUrl', async () => {
    const callerFiles = [
      'app/api/console/settings/route.ts',
      'app/api/checkouts/route.ts',
      'app/api/agent/checkout/route.ts',
    ];

    for (const file of callerFiles) {
      const content = await readFile(file);
      if (content.includes('validateWebhookUrl')) {
        expect(content).toContain('await validateWebhookUrl');
      }
    }
  });
});

// ─── Cron: All cron routes must deny when CRON_SECRET is unset ────────────────

describe('Cron auth guard', () => {
  it('no cron route uses the broken "cronSecret &&" pattern', async () => {
    const cronRoutes = await findRouteFiles('app/api/cron');
    const brokenRoutes: string[] = [];

    for (const file of cronRoutes) {
      const content = await readFile(file);
      // Match the broken pattern: if (cronSecret && ...)
      if (/if\s*\(\s*cronSecret\s*&&/.test(content)) {
        brokenRoutes.push(file);
      }
    }

    expect(brokenRoutes).toEqual([]);
  });

  it('all cron routes use deny-by-default pattern', async () => {
    const cronRoutes = await findRouteFiles('app/api/cron');

    for (const file of cronRoutes) {
      const content = await readFile(file);
      // Must contain the fixed pattern
      expect(content).toContain('!cronSecret ||');
    }
  });
});

// ─── UploadThing: Must use real auth, not hardcoded stub ──────────────────────

describe('UploadThing auth', () => {
  it('does not contain hardcoded user stub', async () => {
    const content = await readFile('app/api/uploadthing/core.ts');
    expect(content).not.toContain('"user1"');
    expect(content).not.toContain("'user1'");
  });

  it('imports getAuthUser for real authentication', async () => {
    const content = await readFile('app/api/uploadthing/core.ts');
    expect(content).toContain('getAuthUser');
  });
});

// ─── Dev seed: Must not use hardcoded API key ─────────────────────────────────

describe('Dev seed endpoint', () => {
  it('does not contain hardcoded API key value', async () => {
    const content = await readFile('app/api/dev/seed/route.ts');
    expect(content).not.toContain('coal_live_dev123456');
  });

  it('uses crypto.randomBytes for key generation', async () => {
    const content = await readFile('app/api/dev/seed/route.ts');
    expect(content).toContain('crypto.randomBytes');
  });

  it('has NODE_ENV production guard', async () => {
    const content = await readFile('app/api/dev/seed/route.ts');
    expect(content).toContain("process.env.NODE_ENV === 'production'");
  });
});

// ─── Payment links: Product ownership must be verified ────────────────────────

describe('Payment link product ownership', () => {
  it('POST handler verifies product belongs to merchant', async () => {
    const content = await readFile('app/api/console/links/route.ts');
    // Must query product with merchantId filter
    expect(content).toContain('merchantId: user.id');
    expect(content).toMatch(/product.*findFirst/);
  });
});

// ─── Metadata: User metadata must be namespaced ───────────────────────────────

describe('Checkout metadata namespacing', () => {
  it('checkouts/route.ts namespaces user metadata under custom key', async () => {
    const content = await readFile('app/api/checkouts/route.ts');
    expect(content).toContain('custom: metadata');
    // Must NOT spread raw metadata at the top level
    expect(content).not.toContain('...(metadata ?? {})');
  });

  it('agent/checkout/route.ts namespaces user metadata under custom key', async () => {
    const content = await readFile('app/api/agent/checkout/route.ts');
    expect(content).toContain('custom: metadata');
    // Must NOT spread raw metadata at the top level
    expect(content).not.toMatch(/\.\.\.\(metadata\s+(as|\?\?)/);
  });
});
