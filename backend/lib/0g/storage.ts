import { randomUUID, createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Batcher, Indexer, KvClient, ZgFile, getFlowContract } from '@0gfoundation/0g-ts-sdk';
import { ethers } from 'ethers';
import { zeroGLogger } from '@/lib/logger';
import { isZeroGStorageConfigured, isZeroGStorageWriteConfigured, zeroGEnv } from '@/lib/0g/env';
import type {
    ZeroGArtifactKind,
    ZeroGDownloadResult,
    ZeroGPublishedArtifact,
} from '@/lib/0g/types';

let cachedIndexer: Indexer | null = null;
let cachedStorageSigner: ethers.Wallet | null = null;
let cachedKvRpcUrl: string | null = null;
let cachedFlowAddress: string | null = null;
const STORAGE_NETWORK_TIMEOUT_MS = 20_000;
const STORAGE_UPLOAD_TIMEOUT_MS = 45_000;
const STORAGE_DOWNLOAD_TIMEOUT_MS = 45_000;

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            },
        );
    });
}

function isRetryableStorageUploadError(error: unknown) {
    if (!(error instanceof Error)) {
        return false;
    }

    const message = error.message.toLowerCase();
    return (
        message.includes('failed to submit transaction') ||
        message.includes('transaction execution reverted') ||
        message.includes('nonce') ||
        message.includes('replacement fee too low') ||
        message.includes('temporarily unavailable') ||
        message.includes('timeout')
    );
}

function stableValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(stableValue);
    }

    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
        return Object.keys(value as Record<string, unknown>)
            .sort()
            .reduce<Record<string, unknown>>((accumulator, key) => {
                accumulator[key] = stableValue((value as Record<string, unknown>)[key]);
                return accumulator;
            }, {});
    }

    return value;
}

export function stableJsonStringify(value: unknown) {
    return JSON.stringify(stableValue(value));
}

export function sha256Hex(value: string | Uint8Array) {
    return `0x${createHash('sha256').update(value).digest('hex')}` as `0x${string}`;
}

function normalizeUploadResult(result: { txHash: string; rootHash: string } | { txHashes: string[]; rootHashes: string[] }) {
    if ('rootHash' in result) {
        return result;
    }

    const firstRootHash = result.rootHashes[0];
    const firstTxHash = result.txHashes[0];

    if (!firstRootHash || !firstTxHash) {
        throw new Error('0G upload returned no root hash or transaction hash');
    }

    return { rootHash: firstRootHash, txHash: firstTxHash };
}

function tempFilePath(kind: string, extension = 'json') {
    return path.join(tmpdir(), `coal-0g-${kind}-${Date.now()}-${randomUUID()}.${extension}`);
}

function isEncryptedPayloadEnvelope(value: unknown): value is {
    version: number;
    algorithm: string;
    iv: string;
    authTag: string;
    ciphertext: string;
} {
    if (!value || typeof value !== 'object') return false;
    const record = value as Record<string, unknown>;
    return (
        typeof record.algorithm === 'string' &&
        record.algorithm === 'aes-256-gcm' &&
        typeof record.iv === 'string' &&
        typeof record.authTag === 'string' &&
        typeof record.ciphertext === 'string'
    );
}

function decryptPayloadEnvelope<T>(value: {
    iv: string;
    authTag: string;
    ciphertext: string;
}) {
    const keyHex = zeroGEnv.storageEncryptionKey;
    if (!keyHex) {
        throw new Error('ZERO_G_STORAGE_ENCRYPTION_KEY is required to read encrypted 0G payloads');
    }

    const normalizedKeyHex = keyHex.startsWith('0x') ? keyHex.slice(2) : keyHex;
    const key = Buffer.from(normalizedKeyHex, 'hex');
    if (key.length !== 32) {
        throw new Error('0G encrypted payloads require a 32-byte hex key');
    }

    const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(value.iv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(value.authTag, 'hex'));

    const plaintext = Buffer.concat([
        decipher.update(Buffer.from(value.ciphertext, 'base64')),
        decipher.final(),
    ]);

    return JSON.parse(plaintext.toString('utf8')) as T;
}

async function createIndexer() {
    if (!isZeroGStorageConfigured()) {
        throw new Error('0G Storage is not configured');
    }

    if (!cachedIndexer) {
        cachedIndexer = new Indexer(zeroGEnv.storageIndexUrl);
    }

    return cachedIndexer;
}

function createStorageSigner() {
    if (!isZeroGStorageWriteConfigured()) {
        throw new Error('0G Storage write operations require ZERO_G_CHAIN_PRIVATE_KEY');
    }

    if (!cachedStorageSigner) {
        const provider = new ethers.JsonRpcProvider(zeroGEnv.chainRpcUrl);
        cachedStorageSigner = new ethers.Wallet(zeroGEnv.chainPrivateKey, provider);
    }

    return cachedStorageSigner;
}

async function resolveKvRpc(indexer: Indexer) {
    if (zeroGEnv.storageKvRpcUrl) {
        return zeroGEnv.storageKvRpcUrl;
    }

    if (cachedKvRpcUrl) {
        return cachedKvRpcUrl;
    }

    const shardedNodes = await withTimeout(
        indexer.getShardedNodes(),
        STORAGE_NETWORK_TIMEOUT_MS,
        '0G KV RPC discovery',
    );
    const node = shardedNodes.trusted[0];
    if (!node?.url) {
        throw new Error('0G Storage returned no KV-capable nodes');
    }

    cachedKvRpcUrl = node.url;
    return cachedKvRpcUrl;
}

async function resolveFlowAddress(indexer: Indexer) {
    if (zeroGEnv.storageFlowAddress) {
        return zeroGEnv.storageFlowAddress;
    }

    if (cachedFlowAddress) {
        return cachedFlowAddress;
    }

    const [nodes, err] = await withTimeout(
        indexer.selectNodes(1),
        STORAGE_NETWORK_TIMEOUT_MS,
        '0G flow contract node selection',
    );
    if (err) {
        throw err;
    }

    const node = nodes[0];
    if (!node) {
        throw new Error('0G Storage returned no nodes to resolve the flow contract');
    }

    const status = await withTimeout(
        node.getStatus(),
        STORAGE_NETWORK_TIMEOUT_MS,
        '0G flow contract status lookup',
    );
    cachedFlowAddress = status.networkIdentity.flowAddress;
    return cachedFlowAddress;
}

export async function checkStorageHealth() {
    if (!isZeroGStorageConfigured()) {
        return {
            enabled: zeroGEnv.enabled,
            configured: false,
            reason: 'ZERO_G_ENABLED is false or ZERO_G_STORAGE_INDEXER_URL is missing',
        };
    }

    const startedAt = Date.now();
    const indexer = await createIndexer();
    const shardedNodes = await withTimeout(
        indexer.getShardedNodes(),
        STORAGE_NETWORK_TIMEOUT_MS,
        '0G storage health node discovery',
    );
    const [nodes] = await withTimeout(
        indexer.selectNodes(1),
        STORAGE_NETWORK_TIMEOUT_MS,
        '0G storage health node selection',
    );

    return {
        enabled: true,
        configured: true,
        latencyMs: Date.now() - startedAt,
        trustedNodeCount: shardedNodes.trusted.length,
        discoveredKvRpcUrl: zeroGEnv.storageKvRpcUrl || shardedNodes.trusted[0]?.url || null,
        flowAddress: zeroGEnv.storageFlowAddress || (nodes[0]
            ? (
                await withTimeout(
                    nodes[0].getStatus(),
                    STORAGE_NETWORK_TIMEOUT_MS,
                    '0G storage health flow status lookup',
                )
            ).networkIdentity.flowAddress
            : null),
        targetMbps: zeroGEnv.storageTargetMbps,
        explorerBaseUrl: zeroGEnv.storageScanBaseUrl,
    };
}

export async function publishJson(input: {
    kind: ZeroGArtifactKind;
    payload: unknown;
    fileName?: string;
}): Promise<ZeroGPublishedArtifact> {
    const startedAt = Date.now();
    const serialized = stableJsonStringify(input.payload);
    const byteSize = Buffer.byteLength(serialized, 'utf8');
    const payloadHash = sha256Hex(serialized);
    const filePath = tempFilePath(input.kind, 'json');

    const indexer = await createIndexer();
    const signer = createStorageSigner();

    await writeFile(filePath, serialized, 'utf8');

    try {
        let lastError: unknown = null;

        for (let attempt = 1; attempt <= 2; attempt += 1) {
            const file = await ZgFile.fromFilePath(filePath);
            try {
                const [tree, treeErr] = await withTimeout(
                    file.merkleTree(),
                    STORAGE_UPLOAD_TIMEOUT_MS,
                    `0G ${input.kind} merkle tree build`,
                );
                if (treeErr) {
                    throw treeErr;
                }

                const [uploadResult, uploadErr] = await withTimeout(
                    indexer.upload(file, zeroGEnv.chainRpcUrl, signer),
                    STORAGE_UPLOAD_TIMEOUT_MS,
                    `0G ${input.kind} upload`,
                );
                if (uploadErr) {
                    throw uploadErr;
                }

                const { rootHash, txHash } = normalizeUploadResult(uploadResult);

                zeroGLogger.info(
                    {
                        kind: input.kind,
                        rootHash,
                        txHash,
                        payloadHash,
                        byteSize,
                        latencyMs: Date.now() - startedAt,
                        attempt,
                    },
                    'Published immutable JSON artifact to 0G Storage log layer',
                );

                return {
                    kind: input.kind,
                    layer: 'log',
                    payloadHash,
                    storageRoot:
                        (typeof tree?.rootHash === 'function' ? tree.rootHash() : rootHash) || undefined,
                    storageTxHash: txHash,
                    storageUri: `0g://log/${rootHash}`,
                    byteSize,
                    publishedAt: new Date().toISOString(),
                    proofVerified: true,
                    retrievalStrategy: 'proof_checked_download',
                };
            } catch (error) {
                lastError = error;

                if (attempt >= 2 || !isRetryableStorageUploadError(error)) {
                    throw error;
                }

                zeroGLogger.warn(
                    {
                        err: error,
                        kind: input.kind,
                        payloadHash,
                        attempt,
                    },
                    '0G Storage upload failed with a retryable error, retrying once',
                );
                await delay(750);
            } finally {
                await file.close();
            }
        }

        throw lastError instanceof Error ? lastError : new Error('0G Storage upload failed');
    } finally {
        await rm(filePath, { force: true }).catch(() => undefined);
    }
}

export async function publishEncryptedJson(input: {
    kind: ZeroGArtifactKind;
    payload: unknown;
    encryptionKeyHex?: string;
}) {
    const keyHex = input.encryptionKeyHex || zeroGEnv.storageEncryptionKey;
    if (!keyHex) {
        throw new Error('ZERO_G_STORAGE_ENCRYPTION_KEY is required for encrypted 0G payloads');
    }

    const normalizedKeyHex = keyHex.startsWith('0x') ? keyHex.slice(2) : keyHex;
    const key = Buffer.from(normalizedKeyHex, 'hex');
    if (key.length !== 32) {
        throw new Error('0G encrypted payloads require a 32-byte hex key');
    }

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const plaintext = Buffer.from(stableJsonStringify(input.payload), 'utf8');
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return publishJson({
        kind: input.kind,
        payload: {
            version: 1,
            algorithm: 'aes-256-gcm',
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
            ciphertext: ciphertext.toString('base64'),
        },
    });
}

export async function upsertMutableJson(input: {
    kind: ZeroGArtifactKind;
    streamId: `0x${string}`;
    key: string;
    payload: unknown;
}) {
    if (!isZeroGStorageWriteConfigured()) {
        throw new Error('0G KV writes require ZERO_G_CHAIN_PRIVATE_KEY');
    }

    const startedAt = Date.now();
    const serialized = stableJsonStringify(input.payload);
    const payloadHash = sha256Hex(serialized);
    const byteSize = Buffer.byteLength(serialized, 'utf8');

    const indexer = await createIndexer();
    const signer = createStorageSigner();
    const [nodes, nodeErr] = await withTimeout(
        indexer.selectNodes(1),
        STORAGE_NETWORK_TIMEOUT_MS,
        `0G ${input.kind} KV node selection`,
    );
    if (nodeErr) {
        throw nodeErr;
    }

    const flowAddress = await resolveFlowAddress(indexer);
    const flowContract = getFlowContract(flowAddress, signer);
    const batcher = new Batcher(1, nodes, flowContract, zeroGEnv.chainRpcUrl);
    const keyBytes = Uint8Array.from(Buffer.from(input.key, 'utf8'));
    const valueBytes = Uint8Array.from(Buffer.from(serialized, 'utf8'));
    batcher.streamDataBuilder.set(input.streamId, keyBytes, valueBytes);

    const [result, batchErr] = await withTimeout(
        batcher.exec(),
        STORAGE_UPLOAD_TIMEOUT_MS,
        `0G ${input.kind} KV upsert`,
    );
    if (batchErr) {
        throw batchErr;
    }

    const encodedKey = Buffer.from(input.key, 'utf8').toString('base64url');

    zeroGLogger.info(
        {
            kind: input.kind,
            streamId: input.streamId,
            kvKey: input.key,
            txHash: result.txHash,
            payloadHash,
            latencyMs: Date.now() - startedAt,
        },
        'Upserted mutable JSON artifact to 0G KV layer',
    );

    return {
        kind: input.kind,
        layer: 'kv' as const,
        payloadHash,
        storageRoot: result.rootHash,
        storageTxHash: result.txHash,
        storageUri: `0g://kv/${input.streamId}/${encodedKey}`,
        byteSize,
        publishedAt: new Date().toISOString(),
        streamId: input.streamId,
        kvKey: input.key,
        proofVerified: false,
        retrievalStrategy: 'low_latency_kv_read',
    };
}

export async function getMutableJson<T>(streamId: `0x${string}`, key: string): Promise<T | null> {
    if (!isZeroGStorageConfigured()) {
        return null;
    }

    const indexer = await createIndexer();
    const kvRpcUrl = await resolveKvRpc(indexer);
    if (!kvRpcUrl) {
        throw new Error('Failed to resolve a 0G KV RPC URL');
    }

    const kvClient = new KvClient(kvRpcUrl);
    const encodedKey = ethers.encodeBase64(Uint8Array.from(Buffer.from(key, 'utf8')));
    const value = await kvClient.getValue(
        streamId,
        encodedKey as unknown as Parameters<KvClient['getValue']>[1],
    );
    if (!value) {
        return null;
    }

    const decoded = Buffer.from(value.data, 'base64').toString('utf8');
    return JSON.parse(decoded) as T;
}

export async function downloadAndVerify(input: {
    rootHash: string;
    outputPath?: string;
    proof?: boolean;
}): Promise<ZeroGDownloadResult> {
    const indexer = await createIndexer();
    const outputPath = input.outputPath || tempFilePath('download', 'bin');
    const startedAt = Date.now();
    const proof = input.proof ?? true;

    const err = await withTimeout(
        indexer.download(input.rootHash, outputPath, proof),
        STORAGE_DOWNLOAD_TIMEOUT_MS,
        `0G download ${input.rootHash}`,
    );
    if (err) {
        throw err;
    }

    const buffer = await readFile(outputPath);
    const durationMs = Math.max(Date.now() - startedAt, 1);
    const throughputMbps = Number((((buffer.byteLength / 1_000_000) / durationMs) * 1000).toFixed(2));

    return {
        rootHash: input.rootHash,
        outputPath,
        byteSize: buffer.byteLength,
        durationMs,
        throughputMbps,
        proofVerified: proof,
        text: buffer.toString('utf8'),
    };
}

export async function loadJsonArtifact<T>(rootHash: string, proof = true) {
    const result = await downloadAndVerify({ rootHash, proof });
    if (!result.text) {
        throw new Error(`Downloaded 0G artifact ${rootHash} did not contain text content`);
    }

    const parsed = JSON.parse(result.text) as unknown;

    return {
        payload: isEncryptedPayloadEnvelope(parsed)
            ? decryptPayloadEnvelope<T>(parsed)
            : (parsed as T),
        download: result,
    };
}

export function getStoragePerformancePlaybook() {
    return [
        `Benchmark against files large enough to saturate the network; tiny payloads will never show ${zeroGEnv.storageTargetMbps} MB/s class throughput.`,
        'Download onto local SSD or NVMe storage so disk writes are not the bottleneck.',
        'Prefer warm repeat runs after the first download to separate cold network discovery from steady-state throughput.',
        'Keep proof verification enabled for integrity-sensitive reads, and benchmark with proof disabled only when measuring raw transport speed.',
        'Use regionally close storage nodes or a colocated worker to reduce RTT and improve sustained throughput.',
    ];
}
