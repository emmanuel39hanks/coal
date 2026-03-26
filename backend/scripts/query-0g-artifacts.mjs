#!/usr/bin/env node
/**
 * Query and display actual 0G artifacts stored by Coal.
 * Downloads from 0G Storage and decodes the JSON content.
 *
 * Usage: node scripts/query-0g-artifacts.mjs
 */

import { config } from 'dotenv';
import { createDecipheriv } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Indexer } from '@0gfoundation/0g-ts-sdk';
import { neon } from '@neondatabase/serverless';

config({ path: '.env' });

const INDEXER_URL = process.env.ZERO_G_STORAGE_INDEXER_URL || 'https://indexer-storage-turbo.0g.ai';
const ENCRYPTION_KEY = process.env.ZERO_G_STORAGE_ENCRYPTION_KEY || '';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
}

const sql = neon(DATABASE_URL);

function decrypt(envelope) {
    if (!ENCRYPTION_KEY) return { note: 'encrypted — ZERO_G_STORAGE_ENCRYPTION_KEY not set' };
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

async function downloadArtifact(indexer, rootHash) {
    const outPath = path.join(tmpdir(), `coal-query-${Date.now()}.json`);
    const err = await indexer.download(rootHash, outPath, false);
    if (err) throw err;
    const content = await readFile(outPath, 'utf8');
    await rm(outPath, { force: true });
    return content;
}

async function main() {
    console.log('=== What Coal Actually Stores on 0G — Decoded ===\n');

    // Query DB for stored artifacts
    const artifacts = await sql`
        SELECT id, kind, layer, status, "storageRoot", "storageTxHash", "payloadHash", "createdAt", "storageUri"
        FROM stored_artifact
        WHERE status = 'published'
        ORDER BY "createdAt" DESC
        LIMIT 10
    `;

    const anchors = await sql`
        SELECT id, kind, "anchorTxHash", "anchorChainId", "payloadHash", "createdAt"
        FROM chain_anchor
        ORDER BY "createdAt" DESC
        LIMIT 5
    `;

    console.log(`Found ${artifacts.length} published artifacts, ${anchors.length} chain anchors\n`);

    const indexer = new Indexer(INDEXER_URL);

    // Download and decode each artifact
    for (const artifact of artifacts) {
        console.log('─'.repeat(70));
        console.log(`KIND:       ${artifact.kind}`);
        console.log(`LAYER:      ${artifact.layer}`);
        console.log(`STORED AT:  ${artifact.createdAt}`);
        console.log(`ROOT HASH:  ${artifact.storageRoot}`);
        console.log(`EXPLORER:   https://storagescan.0g.ai/tx/${artifact.storageTxHash}`);
        console.log(`URI:        ${artifact.storageUri}`);
        console.log();

        if (!artifact.storageRoot) {
            console.log('  (no root hash — cannot download)\n');
            continue;
        }

        try {
            const raw = await downloadArtifact(indexer, artifact.storageRoot);
            let parsed = JSON.parse(raw);

            // Check if encrypted
            if (parsed.algorithm === 'aes-256-gcm' && parsed.ciphertext) {
                console.log('  [ENCRYPTED ENVELOPE — decrypting...]\n');
                try {
                    parsed = decrypt(parsed);
                } catch (e) {
                    console.log(`  (decryption failed: ${e.message})\n`);
                    continue;
                }
            }

            // Pretty print
            const display = JSON.stringify(parsed, null, 2);
            console.log('  DECODED CONTENT:');
            console.log(display.split('\n').map(l => '  ' + l).join('\n'));
            console.log();
        } catch (e) {
            console.log(`  (download failed: ${e.message})\n`);
        }
    }

    // Show chain anchors
    if (anchors.length > 0) {
        console.log('\n' + '='.repeat(70));
        console.log('CHAIN ANCHORS (payment proof hashes on 0G Chain)\n');
        for (const a of anchors) {
            console.log(`  KIND:      ${a.kind}`);
            console.log(`  TX:        https://chainscan.0g.ai/tx/${a.anchorTxHash}`);
            console.log(`  CHAIN ID:  ${a.anchorChainId}`);
            console.log(`  HASH:      ${a.payloadHash}`);
            console.log(`  AT:        ${a.createdAt}`);
            console.log();
        }
    }
}

main().catch((err) => {
    console.error('Failed:', err.message);
    process.exit(1);
});
