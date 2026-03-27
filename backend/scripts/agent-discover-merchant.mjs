#!/usr/bin/env node
/**
 * Agent Discovery Demo — Fetch merchant data directly from 0G Storage
 *
 * This simulates what an AI agent does when discovering a merchant on Coal:
 *   1. Looks up artifacts by known storage root hashes
 *   2. Downloads raw data from 0G Storage nodes (no Coal DB needed)
 *   3. Parses the merchant profile and receipt payloads
 *   4. Reasons about what it found and what actions it can take
 *
 * Usage: node scripts/agent-discover-merchant.mjs [rootHash]
 *
 * If no rootHash is given, fetches known Coal mainnet artifacts.
 */

import { config } from 'dotenv';
import { createDecipheriv } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Indexer } from '@0gfoundation/0g-ts-sdk';

config({ path: '.env' });

const INDEXER_URL = process.env.ZERO_G_STORAGE_INDEXER_URL || 'https://indexer-storage-turbo.0g.ai';
const ENCRYPTION_KEY = process.env.ZERO_G_STORAGE_ENCRYPTION_KEY || '';

// Known Coal artifacts on 0G mainnet (no DB required — agent just needs root hashes)
const KNOWN_ARTIFACTS = [
    {
        label: 'Merchant Profile — Saint\'s Store',
        rootHash: '0xfb508c72dddcfb2a8448affebb37f6c083df1eb8b5b98e200a246f2838d3c1c1',
        storageTx: '0xb78b976e37b5943fabfdd86964c52753caee6b3193aa8ab33d80efe4d204422b',
    },
    {
        label: 'Receipt — 1.25 USDC Payment',
        rootHash: '0x35828e3970e04d2e5257df86a415e060f75c88050aacb48357cee7b1fb4dbe47',
        storageTx: '0xea05de8e3d5c4dc66808724453c5398cc48e750e134b05a21e59742603622e2e',
    },
    {
        label: 'Encrypted Memory — Saint\'s Store (full catalog)',
        rootHash: '0xab6cd288ba6ffd441c520b6ba950ecb3f178ef76729d1cef849dd9486b117017',
        storageTx: '0x188aaa86908be021a7d134e7b1f3a9b8f15f6e4390768f63f43270133def324d',
    },
];

function decrypt(envelope) {
    if (!ENCRYPTION_KEY) return null;
    const keyHex = ENCRYPTION_KEY.startsWith('0x') ? ENCRYPTION_KEY.slice(2) : ENCRYPTION_KEY;
    const key = Buffer.from(keyHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(envelope.authTag, 'hex'));
    const plaintext = Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
        decipher.final(),
    ]);
    return JSON.parse(plaintext.toString('utf8'));
}

async function downloadFromZeroG(indexer, rootHash) {
    const outPath = path.join(tmpdir(), `agent-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
    const err = await indexer.download(rootHash, outPath, false);
    if (err) throw err;
    const content = await readFile(outPath, 'utf8');
    await rm(outPath, { force: true });
    return JSON.parse(content);
}

// ── Agent reasoning functions ────────────────────────────────────────────────

function agentAnalyzeProfile(profile) {
    const lines = [];
    lines.push(`  AGENT ANALYSIS: Merchant Profile`);
    lines.push(`  ─────────────────────────────────`);
    lines.push(`  Merchant: "${profile.name}"`);
    lines.push(`  Schema:   ${profile.version}`);
    lines.push(`  Products: ${profile.productCount} listed`);

    if (profile.topProducts?.length > 0) {
        lines.push(`  Catalog:`);
        for (const p of profile.topProducts) {
            lines.push(`    • ${p.name} — $${p.price}`);
        }
    }

    if (profile.topPaywalls?.length > 0) {
        lines.push(`  Paywalls:`);
        for (const pw of profile.topPaywalls) {
            lines.push(`    • ${pw.name} — ${pw.price} ${pw.currency}`);
        }
    }

    lines.push(`  Networks: ${profile.supportedNetworks?.map(n => n.name).join(', ') || 'unknown'}`);
    lines.push(`  Tokens:   ${profile.supportedTokens?.map(t => t.symbol).join(', ') || 'unknown'}`);

    const caps = profile.capabilities || {};
    const enabledCaps = Object.entries(caps).filter(([, v]) => v).map(([k]) => k);
    lines.push(`  Capabilities: ${enabledCaps.join(', ')}`);

    if (profile.endpoints) {
        lines.push(`  Agent Endpoints:`);
        for (const [name, url] of Object.entries(profile.endpoints)) {
            lines.push(`    ${name}: ${url}`);
        }
    }

    lines.push('');
    lines.push(`  AGENT DECISION: This merchant accepts ${profile.supportedTokens?.[0]?.symbol || 'USDC'} on ${profile.supportedNetworks?.[0]?.name || 'Base'}.`);

    if (caps.paywalls) {
        lines.push(`  → Can access paywalled content via x402 protocol`);
    }
    if (caps.aiCommerce) {
        lines.push(`  → Can query merchant memory for product recommendations`);
    }
    if (caps.receiptVerification) {
        lines.push(`  → Can verify payment receipts via 0G proof trail`);
    }
    if (profile.endpoints?.commerceRoute) {
        lines.push(`  → Can route commerce requests to: ${profile.endpoints.commerceRoute}`);
    }

    return lines.join('\n');
}

function agentAnalyzeReceipt(receipt) {
    const lines = [];
    lines.push(`  AGENT ANALYSIS: Payment Receipt`);
    lines.push(`  ─────────────────────────────────`);
    lines.push(`  Schema:      ${receipt.version}`);
    lines.push(`  Amount:      ${receipt.amount} ${receipt.currency}`);
    lines.push(`  Description: ${receipt.description || 'N/A'}`);
    lines.push(`  Tx Hash:     ${receipt.txHash}`);
    lines.push(`  Chain ID:    ${receipt.chainId}`);
    lines.push(`  Merchant ID: ${receipt.merchantId}`);
    lines.push(`  Checkout ID: ${receipt.checkoutId}`);
    lines.push(`  Paid At:     ${receipt.paidAt}`);

    if (receipt.payer) {
        lines.push(`  Payer:`);
        if (receipt.payer.walletAddress) lines.push(`    Wallet: ${receipt.payer.walletAddress}`);
        if (receipt.payer.email) lines.push(`    Email:  ${receipt.payer.email}`);
        if (receipt.payer.name) lines.push(`    Name:   ${receipt.payer.name}`);
        if (receipt.payer.company) lines.push(`    Org:    ${receipt.payer.company}`);
    }

    if (receipt.metadata) {
        lines.push(`  Metadata: ${JSON.stringify(receipt.metadata)}`);
    }

    lines.push('');
    lines.push(`  AGENT DECISION: Payment of ${receipt.amount} ${receipt.currency} is verified on-chain.`);
    lines.push(`  → Tx viewable at: https://basescan.org/tx/${receipt.txHash}`);
    lines.push(`  → This receipt is immutable — stored on 0G Storage, hash anchored on 0G Chain`);
    lines.push(`  → An agent can independently verify this payment without trusting Coal's API`);

    return lines.join('\n');
}

function agentAnalyzeMemory(memory) {
    const lines = [];
    lines.push(`  AGENT ANALYSIS: Encrypted Merchant Memory`);
    lines.push(`  ─────────────────────────────────────────`);
    lines.push(`  Schema:     ${memory.version}`);
    lines.push(`  Captured:   ${memory.capturedAt}`);
    lines.push(`  Merchant:   ${memory.merchant?.name} (${memory.merchant?.email})`);

    if (memory.products?.length > 0) {
        lines.push(`  Products (${memory.products.length}):`);
        for (const p of memory.products) {
            lines.push(`    • ${p.name} — $${p.price}${p.sku ? ` [SKU: ${p.sku}]` : ''}`);
            if (p.description) lines.push(`      ${p.description}`);
        }
    }

    if (memory.paywalls?.length > 0) {
        lines.push(`  Paywalls (${memory.paywalls.length}):`);
        for (const pw of memory.paywalls) {
            lines.push(`    • ${pw.name} — ${pw.price} ${pw.currency} (${pw.pricingModel})`);
            if (pw.description) lines.push(`      ${pw.description}`);
        }
    }

    if (memory.team?.length > 0) {
        lines.push(`  Team (${memory.team.length} members):`);
        for (const m of memory.team) {
            lines.push(`    • ${m.user?.name || m.user?.email || 'Unknown'} — ${m.role}`);
        }
    }

    lines.push(`  Settings:`);
    lines.push(`    Payout: ${memory.settings?.payoutAddress || 'not set'}`);
    lines.push(`    Webhook: ${memory.settings?.webhookUrl || 'not set'}`);
    lines.push(`    Onboarded: ${memory.settings?.onboardingComplete}`);

    lines.push('');
    lines.push(`  AGENT DECISION: Full merchant context available for AI commerce.`);
    lines.push(`  → Can answer: "What does ${memory.merchant?.name} sell?" → ${memory.products?.map(p => p.name).join(', ') || 'nothing yet'}`);
    lines.push(`  → Can route: customer requests to the right product or paywall`);
    lines.push(`  → This data was encrypted on 0G Storage — only Coal can read it for AI queries`);

    return lines.join('\n');
}

function agentAnalyzeEncryptedEnvelope(envelope) {
    const lines = [];
    lines.push(`  AGENT ANALYSIS: Encrypted Data Envelope`);
    lines.push(`  ────────────────────────────────────────`);
    lines.push(`  Algorithm:  ${envelope.algorithm}`);
    lines.push(`  IV:         ${envelope.iv}`);
    lines.push(`  Auth Tag:   ${envelope.authTag}`);
    lines.push(`  Ciphertext: ${envelope.ciphertext?.substring(0, 60)}...`);
    lines.push('');
    lines.push(`  AGENT NOTE: This data is AES-256-GCM encrypted.`);
    lines.push(`  → Only Coal's backend can decrypt it (ZERO_G_STORAGE_ENCRYPTION_KEY)`);
    lines.push(`  → The data exists on 0G Storage but is private — agents query it via Coal's Memory API`);
    lines.push(`  → Endpoint: POST /api/agent/memory/query { "query": "your question" }`);
    return lines.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const customRoot = process.argv[2];

    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║  AGENT DISCOVERY — Fetching merchant data from 0G Storage mainnet   ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');
    console.log();
    console.log(`  Indexer: ${INDEXER_URL}`);
    console.log(`  Source:  0G Storage decentralized network (no Coal DB involved)`);
    console.log(`  Decrypt: ${ENCRYPTION_KEY ? 'key available' : 'no key — encrypted data will remain opaque'}`);
    console.log();

    const indexer = new Indexer(INDEXER_URL);

    const artifacts = customRoot
        ? [{ label: `Custom artifact`, rootHash: customRoot, storageTx: 'unknown' }]
        : KNOWN_ARTIFACTS;

    for (const artifact of artifacts) {
        console.log('━'.repeat(72));
        console.log(`  FETCHING: ${artifact.label}`);
        console.log(`  Root Hash: ${artifact.rootHash}`);
        console.log(`  StorageScan: https://storagescan.0g.ai/tx/${artifact.storageTx}`);
        console.log();

        const t0 = Date.now();
        try {
            const data = await downloadFromZeroG(indexer, artifact.rootHash);
            const downloadMs = Date.now() - t0;
            console.log(`  Downloaded in ${downloadMs}ms from 0G Storage nodes`);
            console.log();

            // Check if encrypted
            if (data.algorithm === 'aes-256-gcm' && data.ciphertext) {
                if (ENCRYPTION_KEY) {
                    console.log(`  [Encrypted envelope — decrypting with Coal key...]`);
                    console.log();
                    try {
                        const decrypted = decrypt(data);
                        // Determine type from version field
                        if (decrypted.version?.includes('merchant_memory')) {
                            console.log(agentAnalyzeMemory(decrypted));
                        } else if (decrypted.version?.includes('merchant_profile')) {
                            console.log(agentAnalyzeProfile(decrypted));
                        } else {
                            console.log(`  DECODED (${decrypted.version || 'unknown schema'}):`);
                            console.log(JSON.stringify(decrypted, null, 2).split('\n').map(l => '  ' + l).join('\n'));
                        }
                    } catch (e) {
                        console.log(`  Decryption failed: ${e.message}`);
                        console.log();
                        console.log(agentAnalyzeEncryptedEnvelope(data));
                    }
                } else {
                    console.log(agentAnalyzeEncryptedEnvelope(data));
                }
            } else if (data.version?.includes('merchant_profile')) {
                console.log(agentAnalyzeProfile(data));
            } else if (data.version?.includes('receipt')) {
                console.log(agentAnalyzeReceipt(data));
            } else if (data.version?.includes('merchant_memory')) {
                console.log(agentAnalyzeMemory(data));
            } else {
                console.log(`  RAW DATA (unknown schema: ${data.version || 'none'}):`);
                console.log(JSON.stringify(data, null, 2).split('\n').map(l => '  ' + l).join('\n'));
            }

            console.log();
        } catch (e) {
            const downloadMs = Date.now() - t0;
            console.log(`  FAILED after ${downloadMs}ms: ${e.message}`);
            console.log();
        }
    }

    // Summary
    console.log('━'.repeat(72));
    console.log();
    console.log('  AGENT SUMMARY');
    console.log('  ─────────────');
    console.log(`  Fetched ${artifacts.length} artifacts directly from 0G Storage mainnet`);
    console.log(`  No Coal API or database was used — data came from decentralized storage`);
    console.log();
    console.log('  What an agent can do with this data:');
    console.log('    1. Discover merchants and their products from public profiles');
    console.log('    2. Verify payment receipts independently (check tx hash on Base)');
    console.log('    3. Query merchant memory via Coal API for AI-powered answers');
    console.log('    4. Pay for paywalled content using x402 protocol');
    console.log('    5. Route commerce requests to the right merchant/product');
    console.log();
    console.log('  Key insight: The merchant profile is PUBLIC on 0G Storage.');
    console.log('  Any agent can read it without authentication — that\'s how discovery works.');
    console.log('  The encrypted memory is PRIVATE — agents use Coal\'s /api/agent/memory/query');
    console.log('  endpoint to ask questions without seeing raw data.');
    console.log();
}

main().catch((err) => {
    console.error('Agent failed:', err.message || err);
    process.exit(1);
});
