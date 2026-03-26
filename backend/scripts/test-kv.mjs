#!/usr/bin/env node
/**
 * 0G KV End-to-End Test
 *
 * Tests write -> read round-trip on 0G mainnet KV layer.
 * Requires: ZERO_G_CHAIN_PRIVATE_KEY in .env
 *
 * Usage: node scripts/test-kv.mjs
 */

import { createHash } from 'node:crypto';
import { config } from 'dotenv';
import { Batcher, Indexer, KvClient, getFlowContract } from '@0gfoundation/0g-ts-sdk';
import { ethers } from 'ethers';

// Load env
config({ path: '.env' });

const CHAIN_RPC = process.env.ZERO_G_CHAIN_RPC_URL || 'https://evmrpc.0g.ai';
const INDEXER_URL = process.env.ZERO_G_STORAGE_INDEXER_URL || 'https://indexer-storage-turbo.0g.ai';
const FLOW_ADDRESS = process.env.ZERO_G_STORAGE_FLOW_ADDRESS || '0x62D4144dB0F0a6fBBaeb6296c785C71B3D57C526';
const PRIVATE_KEY = process.env.ZERO_G_CHAIN_PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.error('ZERO_G_CHAIN_PRIVATE_KEY is required in .env');
    process.exit(1);
}

function sha256Hex(input) {
    return `0x${createHash('sha256').update(input).digest('hex')}`;
}

function normalizeResult(result) {
    if (result.rootHash) return result;
    return {
        rootHash: result.rootHashes?.[0] || 'unknown',
        txHash: result.txHashes?.[0] || 'unknown',
    };
}

const TEST_STREAM_ID = sha256Hex('coal:test:kv-e2e-test');
const TEST_KEY = 'test:kv:round-trip';
const TEST_PAYLOAD = {
    test: true,
    timestamp: new Date().toISOString(),
    message: 'Coal KV round-trip test on 0G mainnet',
};

async function discoverKvRpc(indexer) {
    // Try env first
    const envKv = process.env.ZERO_G_STORAGE_KV_RPC_URL;
    if (envKv) return envKv;

    // Discover from indexer
    const shardedNodes = await indexer.getShardedNodes();
    const node = shardedNodes.trusted[0];
    if (node?.url) return node.url;
    throw new Error('Could not discover KV RPC URL');
}

async function main() {
    console.log('=== 0G KV End-to-End Test ===\n');
    console.log(`Chain RPC:    ${CHAIN_RPC}`);
    console.log(`Indexer:      ${INDEXER_URL}`);
    console.log(`Flow Address: ${FLOW_ADDRESS}`);
    console.log(`Stream ID:    ${TEST_STREAM_ID}`);
    console.log(`Key:          ${TEST_KEY}\n`);

    // Step 1: Create indexer + signer
    console.log('[1/5] Creating indexer and signer...');
    const indexer = new Indexer(INDEXER_URL);
    const provider = new ethers.JsonRpcProvider(CHAIN_RPC);
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    const address = await signer.getAddress();
    console.log(`  Writer address: ${address}`);

    // Step 2: Discover KV RPC
    console.log('[2/5] Discovering KV RPC...');
    const kvRpcUrl = await discoverKvRpc(indexer);
    console.log(`  KV RPC: ${kvRpcUrl}`);

    // Step 3: Select nodes
    console.log('[3/5] Selecting storage nodes...');
    const [nodes, nodeErr] = await indexer.selectNodes(1);
    if (nodeErr) throw nodeErr;
    console.log(`  Found ${nodes.length} node(s)`);

    // Step 4: Write to KV
    console.log('[4/5] Writing test data to KV...');
    const serialized = JSON.stringify(TEST_PAYLOAD);
    const flowContract = getFlowContract(FLOW_ADDRESS, signer);
    const batcher = new Batcher(1, nodes, flowContract, CHAIN_RPC);
    const keyBytes = Uint8Array.from(Buffer.from(TEST_KEY, 'utf8'));
    const valueBytes = Uint8Array.from(Buffer.from(serialized, 'utf8'));
    batcher.streamDataBuilder.set(TEST_STREAM_ID, keyBytes, valueBytes);

    const writeStart = Date.now();
    const rawResult = await batcher.exec();
    const result = normalizeResult(rawResult);
    const writeMs = Date.now() - writeStart;
    console.log(`  TX Hash:    ${result.txHash}`);
    console.log(`  Root Hash:  ${result.rootHash}`);
    console.log(`  Latency:    ${writeMs}ms`);

    // Step 5: Read back from KV
    console.log('[5/5] Reading back from KV...');
    console.log('  Waiting 5s for propagation...');
    await new Promise((r) => setTimeout(r, 5000));

    const kvClient = new KvClient(kvRpcUrl);
    const encodedKey = ethers.encodeBase64(Uint8Array.from(Buffer.from(TEST_KEY, 'utf8')));
    const readStart = Date.now();
    const value = await kvClient.getValue(TEST_STREAM_ID, encodedKey);
    const readMs = Date.now() - readStart;

    if (!value) {
        console.error('  FAIL: KV read returned null');
        console.log('\n  Note: This could mean:');
        console.log('  - Data has not propagated yet (try again in a few seconds)');
        console.log('  - KV RPC node does not have this stream yet');
        console.log('  - The write succeeded on-chain but KV sync is delayed');
        console.log(`\n  Write TX: ${result.txHash}`);
        console.log('  You can verify the write on: https://chainscan.0g.ai/tx/' + result.txHash);
        process.exit(1);
    }

    const decoded = Buffer.from(value.data, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    console.log(`  Read back:  ${decoded}`);
    console.log(`  Latency:    ${readMs}ms`);

    // Verify
    if (parsed.test === true && parsed.message === TEST_PAYLOAD.message) {
        console.log('\n=== KV Round-Trip: PASS ===');
        console.log(`  Write: ${writeMs}ms | Read: ${readMs}ms`);
        console.log(`  Write TX: https://chainscan.0g.ai/tx/${result.txHash}`);
        console.log(`  Storage URI: 0g://kv/${TEST_STREAM_ID}/${Buffer.from(TEST_KEY, 'utf8').toString('base64url')}`);
    } else {
        console.error('\n=== KV Round-Trip: FAIL (data mismatch) ===');
        console.error('  Expected:', TEST_PAYLOAD);
        console.error('  Got:', parsed);
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('\nTest failed:', err.message || err);
    process.exit(1);
});
