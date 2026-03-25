import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';

const BACKEND_ROOT = path.resolve(__dirname, '../..');

async function readFile(relativePath: string): Promise<string> {
    return fs.readFile(path.join(BACKEND_ROOT, relativePath), 'utf-8');
}

// ── Route file security patterns ─────────────────────────────────────────────

describe('Receipt endpoint: rate limiting', () => {
    it('imports rate limiting utilities', async () => {
        const content = await readFile('app/api/receipts/[id]/route.ts');
        expect(content).toContain('checkRateLimit');
        expect(content).toContain('rateLimiters');
        expect(content).toContain('getIP');
    });

    it('invokes rate limiting before database access', async () => {
        const content = await readFile('app/api/receipts/[id]/route.ts');
        const rateLimitPos = content.indexOf('checkRateLimit');
        const prismaPos = content.indexOf('prisma.');
        expect(rateLimitPos).toBeGreaterThan(-1);
        expect(prismaPos).toBeGreaterThan(-1);
        // Rate limiting must happen before any DB query
        expect(rateLimitPos).toBeLessThan(prismaPos);
    });

    it('uses the public rate limiter (not auth or console)', async () => {
        const content = await readFile('app/api/receipts/[id]/route.ts');
        expect(content).toContain('rateLimiters.public');
    });

    it('returns 429 when rate limited', async () => {
        const content = await readFile('app/api/receipts/[id]/route.ts');
        expect(content).toContain('errors.rateLimited');
    });
});

describe('Receipt endpoint: no auth requirement', () => {
    it('does NOT import getAuthUser (public endpoint)', async () => {
        const content = await readFile('app/api/receipts/[id]/route.ts');
        expect(content).not.toContain('getAuthUser');
    });

    it('does NOT import getCallerUser', async () => {
        const content = await readFile('app/api/receipts/[id]/route.ts');
        expect(content).not.toContain('getCallerUser');
    });

    it('does NOT import privy module', async () => {
        const content = await readFile('app/api/receipts/[id]/route.ts');
        expect(content).not.toContain('@/lib/privy');
    });

    it('does NOT import API key verification', async () => {
        const content = await readFile('app/api/receipts/[id]/route.ts');
        expect(content).not.toContain('verifyApiKey');
    });
});

describe('Receipt endpoint: query safety (SQL injection via ID param)', () => {
    it('uses findUnique with id param (Prisma parameterized query)', async () => {
        const content = await readFile('app/api/receipts/[id]/route.ts');
        // Prisma's findUnique with { where: { id } } generates parameterized SQL
        expect(content).toContain('findUnique');
        expect(content).toContain('where: { id }');
    });

    it('does not use raw SQL queries', async () => {
        const content = await readFile('app/api/receipts/[id]/route.ts');
        expect(content).not.toContain('$queryRaw');
        expect(content).not.toContain('$executeRaw');
        expect(content).not.toContain('prisma.$queryRawUnsafe');
    });

    it('does not concatenate id into query strings', async () => {
        const content = await readFile('app/api/receipts/[id]/route.ts');
        // Ensure no string interpolation in SQL-like contexts
        expect(content).not.toMatch(/`.*\$\{id\}.*`/);
        expect(content).not.toContain("'" + '${id}');
    });
});

describe('Receipt endpoint: data exposure controls', () => {
    it('uses select to limit returned fields (not returning full model)', async () => {
        const content = await readFile('app/api/receipts/[id]/route.ts');
        expect(content).toContain('select:');
        // Should have multiple select blocks for controlled field exposure
        const selectCount = (content.match(/select:/g) || []).length;
        expect(selectCount).toBeGreaterThanOrEqual(2);
    });

    it('does not expose merchant email', async () => {
        const content = await readFile('app/api/receipts/[id]/route.ts');
        // The merchant select block should not include email
        const merchantSelectMatch = content.match(/merchant:\s*\{[\s\S]*?select:\s*\{([\s\S]*?)\}/);
        expect(merchantSelectMatch).not.toBeNull();
        const merchantFields = merchantSelectMatch![1];
        expect(merchantFields).not.toContain('email');
    });

    it('does not expose merchant payoutAddress in response', async () => {
        const content = await readFile('app/api/receipts/[id]/route.ts');
        const merchantSelectMatch = content.match(/merchant:\s*\{[\s\S]*?select:\s*\{([\s\S]*?)\}/);
        expect(merchantSelectMatch).not.toBeNull();
        const merchantFields = merchantSelectMatch![1];
        expect(merchantFields).not.toContain('payoutAddress');
    });

    it('does not expose webhook URL or secret', async () => {
        const content = await readFile('app/api/receipts/[id]/route.ts');
        expect(content).not.toContain('webhookUrl');
        expect(content).not.toContain('webhookSecret');
    });

    it('does not expose API keys', async () => {
        const content = await readFile('app/api/receipts/[id]/route.ts');
        expect(content).not.toContain('apiKey');
        expect(content).not.toContain('apiKeys');
    });
});

describe('Receipt endpoint: error handling', () => {
    it('has a try-catch that returns errors.internal()', async () => {
        const content = await readFile('app/api/receipts/[id]/route.ts');
        expect(content).toContain('} catch');
        expect(content).toContain('errors.internal()');
    });

    it('returns errors.notFound for missing session', async () => {
        const content = await readFile('app/api/receipts/[id]/route.ts');
        expect(content).toContain("errors.notFound('Receipt')");
    });

    it('does not leak stack traces or internal details in catch block', async () => {
        const content = await readFile('app/api/receipts/[id]/route.ts');
        // The catch block should call errors.internal(), not return raw error
        const catchBlock = content.slice(content.lastIndexOf('} catch'));
        expect(catchBlock).not.toContain('error.message');
        expect(catchBlock).not.toContain('error.stack');
        expect(catchBlock).not.toContain('err.message');
    });
});

describe('Receipt endpoint: unconfirmed session handling', () => {
    it('returns verified: false for non-confirmed sessions', async () => {
        const content = await readFile('app/api/receipts/[id]/route.ts');
        expect(content).toContain('verified: false');
        // Check it is gated on session status
        expect(content).toContain("status !== 'confirmed'");
    });

    it('does not expose proof trail for unconfirmed sessions', async () => {
        const content = await readFile('app/api/receipts/[id]/route.ts');
        expect(content).toContain('proofTrail: null');
    });
});

describe('Receipt endpoint: only exports GET handler', () => {
    it('exports a GET function', async () => {
        const content = await readFile('app/api/receipts/[id]/route.ts');
        expect(content).toMatch(/export\s+async\s+function\s+GET/);
    });

    it('does not export POST, PUT, PATCH, or DELETE', async () => {
        const content = await readFile('app/api/receipts/[id]/route.ts');
        expect(content).not.toMatch(/export\s+async\s+function\s+POST/);
        expect(content).not.toMatch(/export\s+async\s+function\s+PUT/);
        expect(content).not.toMatch(/export\s+async\s+function\s+PATCH/);
        expect(content).not.toMatch(/export\s+async\s+function\s+DELETE/);
    });
});

// ── Sealed Inference & Compute source file patterns ──────────────────────────

describe('Sealed Inference security patterns (compute.ts)', () => {
    it('isSealedInferenceEnabled requires both sealedInferenceEnabled AND compute configured', async () => {
        const content = await readFile('lib/0g/compute.ts');
        expect(content).toContain('zeroGEnv.sealedInferenceEnabled');
        expect(content).toContain('isZeroGComputeConfigured()');
    });

    it('verificationStatus can only be direct_secret or sealed_tee', async () => {
        const content = await readFile('lib/0g/compute.ts');
        expect(content).toContain("'direct_secret'");
        expect(content).toContain("'sealed_tee'");
        // These should be the only verificationStatus values
        const statusMatches = content.match(/verificationStatus.*?['"](\w+)['"]/g) || [];
        const statuses = statusMatches.map(m => {
            const match = m.match(/['"](\w+)['"]/);
            return match ? match[1] : '';
        });
        const uniqueStatuses = [...new Set(statuses.filter(Boolean))];
        expect(uniqueStatuses).toEqual(expect.arrayContaining(['direct_secret', 'sealed_tee']));
        expect(uniqueStatuses.length).toBe(2);
    });

    it('compute client uses a timeout (does not hang indefinitely)', async () => {
        const content = await readFile('lib/0g/compute.ts');
        expect(content).toContain('timeout: 30_000');
    });

    it('TEE verification has a timeout', async () => {
        const content = await readFile('lib/0g/compute.ts');
        expect(content).toContain('90_000');
        expect(content).toContain('TEE verification');
    });

    it('does not expose private key in logs or responses', async () => {
        const content = await readFile('lib/0g/compute.ts');
        // chainPrivateKey should only appear in the guard check and wallet init
        const privateKeyRefs = (content.match(/chainPrivateKey/g) || []).length;
        // Should only reference it for configuration checks and wallet construction
        expect(privateKeyRefs).toBeLessThanOrEqual(3);
        // Should not log the private key
        expect(content).not.toMatch(/log.*chainPrivateKey/i);
        expect(content).not.toMatch(/console\.log.*private/i);
    });
});
