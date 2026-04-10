/**
 * 0G Data Availability (DA) integration for Coal.
 *
 * Posts payment events (confirmations, subscription renewals, webhook deliveries)
 * as DA blobs to the 0G DA layer via a local gRPC sidecar.
 *
 * The DA sidecar (0g-da-client) must be running locally on ZERO_G_DA_GRPC_URL
 * for DA posting to work. If the sidecar is unavailable, DA operations fail
 * gracefully without blocking payment flows.
 *
 * @see https://github.com/0gfoundation/0g-da-client
 */

import path from 'node:path';
import { createHash } from 'node:crypto';
import { zeroGLogger } from '@/lib/logger';
import { zeroGEnv } from '@/lib/0g/env';
import { stableJsonStringify } from '@/lib/0g/storage';

// ─── DA Event Types ──────────────────────────────────────────────────────────

export type DAEventKind =
    | 'payment_confirmed'
    | 'subscription_renewed'
    | 'subscription_created'
    | 'webhook_delivered'
    | 'paywall_access_granted'
    | 'receipt_anchored';

export interface DAPaymentEvent {
    version: 'coal.da_event.v1';
    kind: DAEventKind;
    merchantId: string;
    timestamp: string;
    payload: Record<string, unknown>;
    payloadHash: string;
}

interface DADisperseResult {
    requestId: string;
    status: string;
    blobInfo?: {
        storageRoot: string;
        epoch: string;
        quorumId: string;
    };
}

// ─── Configuration ───────────────────────────────────────────────────────────

const DA_GRPC_URL = process.env.ZERO_G_DA_GRPC_URL || 'localhost:51001';
const DA_ENABLED = process.env.ZERO_G_DA_ENABLED === 'true';
// 0G DA sidecars typically serve plain (insecure) gRPC over a private or firewalled network.
// Default to insecure; set ZERO_G_DA_GRPC_TLS=true to require TLS (e.g. behind a reverse proxy).
const DA_USE_TLS = process.env.ZERO_G_DA_GRPC_TLS === 'true';
const DA_TIMEOUT_MS = 10_000;
const DA_POLL_INTERVAL_MS = 2_000;
const DA_MAX_POLL_ATTEMPTS = 5;
const DA_MAX_PAYLOAD_BYTES = 256_000; // 256 KB max DA payload

export function isDAEnabled(): boolean {
    return zeroGEnv.enabled && DA_ENABLED;
}

export function getDAConfig() {
    return {
        enabled: isDAEnabled(),
        grpcUrl: DA_GRPC_URL,
        timeoutMs: DA_TIMEOUT_MS,
    };
}

// ─── gRPC Client (lazy loaded) ──────────────────────────────────────────────

let grpcClient: any = null;
let grpcClientError: Error | null = null;
let grpcClientErrorTime = 0;
const GRPC_ERROR_RETRY_MS = 30_000; // retry after 30s on transient failures

async function getDAClient() {
    // Allow retry after timeout (M1: don't cache errors permanently)
    if (grpcClientError) {
        if (Date.now() - grpcClientErrorTime < GRPC_ERROR_RETRY_MS) {
            throw grpcClientError;
        }
        grpcClientError = null;
        grpcClient = null;
    }
    if (grpcClient) return grpcClient;

    try {
        const grpc = await import('@grpc/grpc-js');
        const protoLoader = await import('@grpc/proto-loader');

        // Proto path must be resolvable in both local dev and the Vercel serverless bundle.
        // next.config.ts uses outputFileTracingIncludes to copy proto/ into the bundle;
        // we try the bundled path first, then fall back to the source path.
        const candidatePaths = [
            path.resolve(__dirname, 'proto/disperser.proto'),
            path.resolve(process.cwd(), 'backend/lib/0g/proto/disperser.proto'),
            path.resolve(process.cwd(), 'lib/0g/proto/disperser.proto'),
        ];
        let packageDefinition: any = null;
        let lastLoadError: unknown = null;
        for (const candidate of candidatePaths) {
            try {
                packageDefinition = protoLoader.loadSync(candidate, {
                    keepCase: true,
                    longs: String,
                    enums: String,
                    defaults: true,
                    oneofs: true,
                });
                break;
            } catch (loadErr) {
                lastLoadError = loadErr;
            }
        }
        if (!packageDefinition) {
            throw lastLoadError instanceof Error
                ? lastLoadError
                : new Error('0G DA proto file not found in any candidate path');
        }

        const proto = grpc.loadPackageDefinition(packageDefinition) as any;

        // 0G DA sidecars default to insecure gRPC; set ZERO_G_DA_GRPC_TLS=true to force TLS.
        const credentials = DA_USE_TLS
            ? grpc.credentials.createSsl()
            : grpc.credentials.createInsecure();

        grpcClient = new proto.disperser.Disperser(DA_GRPC_URL, credentials);
        return grpcClient;
    } catch (error) {
        grpcClientError = error instanceof Error ? error : new Error('Failed to create DA gRPC client');
        grpcClientErrorTime = Date.now();
        throw grpcClientError;
    }
}

// ─── Core DA Operations ──────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
        promise.then(
            (value) => { clearTimeout(timer); resolve(value); },
            (error) => { clearTimeout(timer); reject(error); },
        );
    });
}

async function disperseBlob(data: Buffer): Promise<{ status: string; requestId: Buffer }> {
    const client = await getDAClient();
    return new Promise((resolve, reject) => {
        client.DisperseBlob({ data }, (err: any, response: any) => {
            if (err) return reject(err);
            resolve({
                status: response.result,
                requestId: Buffer.from(response.request_id),
            });
        });
    });
}

async function getBlobStatus(requestId: Buffer): Promise<{
    status: string;
    info?: { storageRoot: Buffer; epoch: string; quorumId: string };
}> {
    const client = await getDAClient();
    return new Promise((resolve, reject) => {
        client.GetBlobStatus({ request_id: requestId }, (err: any, response: any) => {
            if (err) return reject(err);
            resolve({
                status: response.status,
                info: response.info?.blob_header
                    ? {
                        storageRoot: Buffer.from(response.info.blob_header.storage_root),
                        epoch: response.info.blob_header.epoch,
                        quorumId: response.info.blob_header.quorum_id,
                    }
                    : undefined,
            });
        });
    });
}

// ─── Event Building ──────────────────────────────────────────────────────────

export function buildDAEvent(kind: DAEventKind, merchantId: string, payload: Record<string, unknown>): DAPaymentEvent {
    const serialized = stableJsonStringify(payload);
    const payloadHash = `0x${createHash('sha256').update(serialized).digest('hex')}`;

    return {
        version: 'coal.da_event.v1',
        kind,
        merchantId,
        timestamp: new Date().toISOString(),
        payload,
        payloadHash,
    };
}

// ─── Event Log (in-memory, for demo visibility) ─────────────────────────────

interface DAEventLogEntry {
    kind: DAEventKind;
    merchantId: string;
    requestId: string | null;
    status: string;
    byteSize: number;
    timestamp: string;
    payloadHash: string;
}

const recentDAEvents: DAEventLogEntry[] = [];
const MAX_EVENT_LOG = 50;

export function getRecentDAEvents(): DAEventLogEntry[] {
    return [...recentDAEvents];
}

function logDAEvent(entry: DAEventLogEntry) {
    recentDAEvents.unshift(entry);
    if (recentDAEvents.length > MAX_EVENT_LOG) {
        recentDAEvents.pop();
    }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Post a payment event to 0G DA. Fire-and-forget with logging.
 * Returns the disperse result if successful, null if DA is disabled or fails.
 */
export async function postDAEvent(
    kind: DAEventKind,
    merchantId: string,
    payload: Record<string, unknown>,
): Promise<DADisperseResult | null> {
    if (!isDAEnabled()) {
        return null;
    }

    const event = buildDAEvent(kind, merchantId, payload);
    const data = Buffer.from(stableJsonStringify(event), 'utf-8');

    // H4: Reject oversized payloads
    if (data.byteLength > DA_MAX_PAYLOAD_BYTES) {
        zeroGLogger.warn(
            { kind, merchantId, byteSize: data.byteLength, maxBytes: DA_MAX_PAYLOAD_BYTES },
            '0G DA event payload exceeds size limit — skipping',
        );
        return null;
    }

    try {
        const { status, requestId } = await withTimeout(
            disperseBlob(data),
            DA_TIMEOUT_MS,
            `0G DA disperse ${kind}`,
        );

        const result: DADisperseResult = {
            requestId: requestId.toString('hex'),
            status,
        };

        zeroGLogger.info(
            {
                kind,
                merchantId,
                requestId: result.requestId,
                status,
                byteSize: data.byteLength,
            },
            'Posted payment event to 0G DA',
        );

        // Track for demo visibility
        logDAEvent({
            kind,
            merchantId,
            requestId: result.requestId,
            status: String(status),
            byteSize: data.byteLength,
            timestamp: event.timestamp,
            payloadHash: event.payloadHash,
        });

        // Poll for confirmation in background (best-effort)
        pollForConfirmation(requestId, kind, merchantId).catch((error) => {
            zeroGLogger.warn(
                { err: error, kind, merchantId, requestId: result.requestId },
                '0G DA blob confirmation polling failed',
            );
        });

        return result;
    } catch (error) {
        zeroGLogger.warn(
            { err: error, kind, merchantId },
            '0G DA event posting failed (non-blocking)',
        );
        return null;
    }
}

async function pollForConfirmation(requestId: Buffer, kind: string, merchantId: string) {
    for (let i = 0; i < DA_MAX_POLL_ATTEMPTS; i++) {
        await new Promise((r) => setTimeout(r, DA_POLL_INTERVAL_MS));

        const result = await getBlobStatus(requestId);
        if (result.status === 'CONFIRMED' || result.status === 'FINALIZED') {
            zeroGLogger.info(
                {
                    kind,
                    merchantId,
                    requestId: requestId.toString('hex'),
                    status: result.status,
                    storageRoot: result.info?.storageRoot.toString('hex'),
                    epoch: result.info?.epoch,
                },
                '0G DA blob confirmed',
            );
            return result;
        }

        if (result.status === 'FAILED' || result.status === 'INSUFFICIENT_SIGNATURES') {
            zeroGLogger.warn(
                { kind, merchantId, requestId: requestId.toString('hex'), status: result.status },
                '0G DA blob dispersal failed',
            );
            return result;
        }
    }
}

/**
 * Check DA sidecar health by attempting to connect.
 */
export async function checkDAHealth(): Promise<{
    enabled: boolean;
    configured: boolean;
    connected: boolean;
    grpcUrl: string;
    error?: string;
}> {
    if (!isDAEnabled()) {
        return {
            enabled: false,
            configured: false,
            connected: false,
            grpcUrl: DA_GRPC_URL,
        };
    }

    try {
        await withTimeout(getDAClient(), 15_000, '0G DA health check');
        return {
            enabled: true,
            configured: true,
            connected: true,
            grpcUrl: DA_GRPC_URL,
        };
    } catch (error) {
        // M3: Log detailed error internally, return generic message externally
        zeroGLogger.warn({ err: error }, '0G DA health check failed');
        return {
            enabled: true,
            configured: true,
            connected: false,
            grpcUrl: DA_GRPC_URL,
            error: 'DA sidecar unavailable',
        };
    }
}
