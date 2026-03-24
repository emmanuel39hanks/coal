export const zeroGArtifactKinds = [
    'paywall_manifest',
    'receipt_payload',
    'merchant_profile',
    'merchant_memory_snapshot',
    'ai_commerce_response_bundle',
] as const;

export type ZeroGArtifactKind = (typeof zeroGArtifactKinds)[number];
export type ZeroGLayer = 'log' | 'kv';

export interface ZeroGPublishedArtifact {
    kind: ZeroGArtifactKind;
    layer: ZeroGLayer;
    payloadHash: `0x${string}`;
    storageRoot?: string;
    storageTxHash?: string;
    storageUri: string;
    byteSize: number;
    publishedAt: string;
    streamId?: string;
    kvKey?: string;
    proofVerified?: boolean;
    retrievalStrategy?: string;
}

export interface ZeroGDownloadResult {
    rootHash: string;
    outputPath: string;
    byteSize: number;
    durationMs: number;
    throughputMbps: number;
    proofVerified: boolean;
    text?: string;
}

export interface ZeroGChainAnchorResult {
    kind: 'receipt' | 'entitlement' | 'profile';
    payloadHash: `0x${string}`;
    artifactRoot: `0x${string}`;
    subjectHash: `0x${string}`;
    anchorTxHash: `0x${string}`;
    anchorContract: `0x${string}`;
    anchorChainId: number;
    anchoredAt: string;
}

export interface ZeroGComputeService {
    providerAddress: string;
    model: string;
    endpoint?: string;
    serviceName?: string;
    uptimePct?: number | null;
    avgLatencyMs?: number | null;
    raw: unknown;
}

export interface ZeroGComputeMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ReceiptPayload {
    version: 'coal.receipt.v1';
    kind: 'receipt_payload';
    receiptId: string;
    checkoutSessionId: string;
    merchantId: string;
    merchantName: string | null;
    merchantEmail: string | null;
    payoutAddress: string | null;
    amount: string;
    currency: string;
    description: string | null;
    settlementToken: {
        address: string;
        symbol: string;
        name: string;
        decimals: number;
    };
    chain: {
        id: number;
        name: string;
        explorerUrl: string;
    };
    transaction: {
        hash: string;
        from: string;
        to: string;
        amount: string;
        blockNumber: number | null;
        status: string;
    };
    metadata: Record<string, unknown> | null;
    createdAt: string;
    confirmedAt: string;
}

export interface PaywallManifest {
    version: 'coal.paywall_manifest.v1';
    paywallId: string;
    merchantId: string;
    merchantName: string | null;
    name: string;
    description: string | null;
    price: string;
    currency: string;
    contentType: string;
    pricingModel: string;
    active: boolean;
    contentUrl: string | null;
    recipient: string | null;
    network: {
        id: number;
        name: string;
    };
    settlementToken: {
        address: string;
        symbol: string;
        name: string;
        decimals: number;
    };
    entitlement: {
        type: 'wallet_access';
        supportedSubjects: Array<'wallet'>;
    };
    payment: {
        verifyUrl: string;
        payUrl: string;
        payIntentUrl: string;
        receiptVerifyUrlTemplate: string;
    };
    merchantProfile: {
        storageUri: string | null;
        storageRoot: string | null;
    } | null;
    createdAt: string;
    updatedAt: string;
}

export interface MerchantProfileBundle {
    version: 'coal.merchant_profile.v1';
    merchantId: string;
    name: string | null;
    email: string | null;
    payoutAddress: string | null;
    webhookUrl: string | null;
    productCount: number;
    paywallCount: number;
    teamSize: number;
    webhookConfigured: boolean;
    onboardingComplete: boolean;
    topProducts: Array<{
        id: string;
        name: string;
        price: string;
    }>;
    topPaywalls: Array<{
        id: string;
        name: string;
        price: string;
        currency: string;
    }>;
    supportedNetworks: Array<{
        id: number;
        name: string;
    }>;
    supportedTokens: Array<{
        address: string;
        symbol: string;
        name: string;
        decimals: number;
    }>;
    capabilities: {
        paywalls: boolean;
        receiptVerification: boolean;
        aiCommerce: boolean;
        merchantMemory: boolean;
    };
    endpoints: {
        merchantProfile: string;
        memoryQuery: string;
        commerceRoute: string;
    };
    urls: {
        profile: string;
        docs: string;
    };
    updatedAt: string;
}

export interface MerchantMemorySnapshot {
    version: 'coal.merchant_memory.v1';
    merchantId: string;
    capturedAt: string;
    merchant: {
        name: string | null;
        email: string | null;
        payoutAddress: string | null;
        webhookUrl: string | null;
        onboardingComplete: boolean;
    };
    products: Array<Record<string, unknown>>;
    paywalls: Array<Record<string, unknown>>;
    settings: Record<string, unknown>;
    team: Array<Record<string, unknown>>;
}
