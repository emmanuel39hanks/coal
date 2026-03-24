import { zeroGLogger } from '@/lib/logger';

function readEnv(key: string) {
    const value = process.env[key];
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
}

function readBoolean(key: string, fallback = false) {
    const value = readEnv(key);
    if (!value) return fallback;
    return value === '1' || value.toLowerCase() === 'true';
}

function readInteger(key: string, fallback: number) {
    const value = readEnv(key);
    if (!value) return fallback;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
        zeroGLogger.warn({ key, value }, 'Invalid 0G integer env value, falling back to default');
        return fallback;
    }
    return parsed;
}

const ZERO_G_ENABLED = readBoolean('ZERO_G_ENABLED', false);
const ZERO_G_COMPUTE_ENABLED = readBoolean('ZERO_G_COMPUTE_ENABLED', false);

const zeroGEnvWarnings: string[] = [];

function pushWarning(message: string) {
    zeroGEnvWarnings.push(`[Coal 0G] ${message}`);
}

export const zeroGEnv = {
    enabled: ZERO_G_ENABLED,
    chainRpcUrl: readEnv('ZERO_G_CHAIN_RPC_URL') || 'https://evmrpc.0g.ai',
    chainId: readInteger('ZERO_G_CHAIN_ID', 16661),
    chainPrivateKey: readEnv('ZERO_G_CHAIN_PRIVATE_KEY') || '',
    receiptAnchorAddress: readEnv('ZERO_G_RECEIPT_ANCHOR_ADDRESS') || '',
    chainScanBaseUrl: readEnv('ZERO_G_CHAINSCAN_URL') || 'https://chainscan.0g.ai',
    storageIndexUrl: readEnv('ZERO_G_STORAGE_INDEXER_URL') || 'https://indexer-storage-turbo.0g.ai',
    storageKvRpcUrl: readEnv('ZERO_G_STORAGE_KV_RPC_URL') || '',
    storageFlowAddress: readEnv('ZERO_G_STORAGE_FLOW_ADDRESS') || '',
    storageStreamId: readEnv('ZERO_G_STORAGE_STREAM_ID') || '',
    storageEncryptionKey: readEnv('ZERO_G_STORAGE_ENCRYPTION_KEY') || '',
    storageTargetMbps: readInteger('ZERO_G_STORAGE_TARGET_MBPS', 200),
    storageScanBaseUrl: readEnv('ZERO_G_STORAGESCAN_URL') || 'https://storagescan.0g.ai',
    computeEnabled: ZERO_G_COMPUTE_ENABLED,
    computeProvider: readEnv('ZERO_G_COMPUTE_PROVIDER') || '',
    computeBaseUrl: readEnv('ZERO_G_COMPUTE_BASE_URL') || '',
    computeApiKey: readEnv('ZERO_G_COMPUTE_API_KEY') || '',
    computeModel: readEnv('ZERO_G_COMPUTE_MODEL') || '',
} as const;

if (zeroGEnv.enabled && !zeroGEnv.chainPrivateKey) {
    pushWarning('ZERO_G_ENABLED=true but ZERO_G_CHAIN_PRIVATE_KEY is missing. Storage uploads and anchor writes will stay read-only.');
}
if (zeroGEnv.enabled && !zeroGEnv.receiptAnchorAddress) {
    pushWarning('ZERO_G_ENABLED=true but ZERO_G_RECEIPT_ANCHOR_ADDRESS is not set yet. Receipt publication can proceed, but chain anchoring will be skipped.');
}
if (zeroGEnv.computeEnabled && !zeroGEnv.computeBaseUrl) {
    pushWarning('ZERO_G_COMPUTE_ENABLED=true but ZERO_G_COMPUTE_BASE_URL is missing. Direct OpenAI-compatible inference calls will be unavailable.');
}
if (zeroGEnv.computeEnabled && !zeroGEnv.computeApiKey) {
    pushWarning('ZERO_G_COMPUTE_ENABLED=true but ZERO_G_COMPUTE_API_KEY is missing. Direct OpenAI-compatible inference calls will be unavailable.');
}

for (const warning of zeroGEnvWarnings) {
    zeroGLogger.warn(warning);
}

export function isZeroGEnabled() {
    return zeroGEnv.enabled;
}

export function isZeroGStorageConfigured() {
    return zeroGEnv.enabled && Boolean(zeroGEnv.storageIndexUrl && zeroGEnv.chainRpcUrl);
}

export function isZeroGStorageWriteConfigured() {
    return isZeroGStorageConfigured() && Boolean(zeroGEnv.chainPrivateKey);
}

export function isZeroGMutableMirrorConfigured() {
    return isZeroGStorageWriteConfigured() && Boolean(zeroGEnv.storageStreamId);
}

export function isZeroGChainWriteConfigured() {
    return zeroGEnv.enabled && Boolean(zeroGEnv.chainPrivateKey && zeroGEnv.receiptAnchorAddress);
}

export function isZeroGComputeConfigured() {
    return zeroGEnv.computeEnabled && Boolean(zeroGEnv.computeBaseUrl && zeroGEnv.computeApiKey);
}
