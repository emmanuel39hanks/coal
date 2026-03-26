import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { zeroGLogger } from '@/lib/logger';
import { buildZeroGStreamId, getLatestArtifact } from '@/lib/0g/catalog';
import { isZeroGEnabled } from '@/lib/0g/env';
import {
    loadJsonArtifact,
    publishEncryptedJson,
    publishJson,
    sha256Hex,
    stableJsonStringify,
    upsertMutableJson,
} from '@/lib/0g/storage';
import type { MerchantMemorySnapshot, MerchantProfileBundle } from '@/lib/0g/types';
import { CHAIN_ID, getSettlementToken } from '@/lib/chain';

const PROFILE_KV_KEY = 'merchant:profile:latest';
const MEMORY_POINTER_KV_KEY = 'merchant:memory:latest';
const FRONTEND_URL = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const MERCHANT_MEMORY_READ_TIMEOUT_MS = 8_000;

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

async function loadMerchantContext(merchantId: string) {
    return prisma.user.findUnique({
        where: { id: merchantId },
        select: {
            id: true,
            name: true,
            email: true,
            payoutAddress: true,
            webhookUrl: true,
            webhookSecret: true,
            onboardingComplete: true,
            updatedAt: true,
            products: {
                where: { active: true },
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    price: true,
                    sku: true,
                    image: true,
                    createdAt: true,
                    updatedAt: true,
                },
            },
            paywalls: {
                where: { active: true },
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    price: true,
                    currency: true,
                    contentType: true,
                    contentUrl: true,
                    pricingModel: true,
                    createdAt: true,
                    updatedAt: true,
                },
            },
            ownedTeam: {
                orderBy: { createdAt: 'asc' },
                select: {
                    id: true,
                    role: true,
                    createdAt: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            },
        },
    });
}

type LoadedMerchantContext = NonNullable<Awaited<ReturnType<typeof loadMerchantContext>>>;

function latestMerchantChangeAt(merchant: LoadedMerchantContext) {
    const timestamps = [
        merchant.updatedAt,
        ...merchant.products.map((product) => product.updatedAt),
        ...merchant.paywalls.map((paywall) => paywall.updatedAt),
        ...merchant.ownedTeam.map((member) => member.createdAt),
    ];

    const latest = timestamps.reduce((current, value) =>
        value.getTime() > current.getTime() ? value : current,
    );

    return latest.toISOString();
}

export async function buildMerchantProfileBundle(merchantId: string): Promise<MerchantProfileBundle | null> {
    const merchant = await loadMerchantContext(merchantId);
    if (!merchant) {
        return null;
    }

    const settlementToken = getSettlementToken();

    return {
        version: 'coal.merchant_profile.v1',
        merchantId: merchant.id,
        name: merchant.name,
        email: merchant.email,
        payoutAddress: merchant.payoutAddress,
        webhookUrl: merchant.webhookUrl,
        productCount: merchant.products.length,
        paywallCount: merchant.paywalls.length,
        teamSize: merchant.ownedTeam.length,
        webhookConfigured: Boolean(merchant.webhookUrl && merchant.webhookSecret),
        onboardingComplete: merchant.onboardingComplete,
        topProducts: merchant.products.slice(0, 5).map((product) => ({
            id: product.id,
            name: product.name,
            price: product.price.toString(),
            image: product.image,
        })),
        topPaywalls: merchant.paywalls.slice(0, 5).map((paywall) => ({
            id: paywall.id,
            name: paywall.name,
            price: paywall.price.toString(),
            currency: paywall.currency,
        })),
        supportedNetworks: [
            {
                id: CHAIN_ID,
                name: 'base',
            },
        ],
        supportedTokens: [
            {
                address: settlementToken.address,
                symbol: settlementToken.symbol,
                name: settlementToken.name,
                decimals: settlementToken.decimals,
            },
        ],
        capabilities: {
            paywalls: merchant.paywalls.length > 0,
            receiptVerification: true,
            aiCommerce: true,
            merchantMemory: true,
        },
        endpoints: {
            merchantProfile: `${API_BASE_URL}/api/agent/merchant-profiles/${merchant.id}`,
            memoryQuery: `${API_BASE_URL}/api/agent/memory/query`,
            commerceRoute: `${API_BASE_URL}/api/agent/commerce/route`,
        },
        urls: {
            profile: `${FRONTEND_URL}/console/settings`,
            docs: `${FRONTEND_URL}/docs`,
        },
        updatedAt: latestMerchantChangeAt(merchant),
    };
}

export async function buildMerchantMemorySnapshot(merchantId: string): Promise<MerchantMemorySnapshot | null> {
    const merchant = await loadMerchantContext(merchantId);
    if (!merchant) {
        return null;
    }

    return {
        version: 'coal.merchant_memory.v1',
        merchantId: merchant.id,
        capturedAt: latestMerchantChangeAt(merchant),
        merchant: {
            name: merchant.name,
            email: merchant.email,
            payoutConfigured: Boolean(merchant.payoutAddress),
            webhookConfigured: Boolean(merchant.webhookUrl),
            onboardingComplete: merchant.onboardingComplete,
        },
        products: merchant.products.map((product) => ({
            id: product.id,
            name: product.name,
            description: product.description,
            price: product.price.toString(),
            sku: product.sku,
            image: product.image,
            createdAt: product.createdAt.toISOString(),
            updatedAt: product.updatedAt.toISOString(),
        })),
        paywalls: merchant.paywalls.map((paywall) => ({
            id: paywall.id,
            name: paywall.name,
            description: paywall.description,
            price: paywall.price.toString(),
            currency: paywall.currency,
            contentType: paywall.contentType,
            contentUrl: paywall.contentUrl,
            pricingModel: paywall.pricingModel,
            createdAt: paywall.createdAt.toISOString(),
            updatedAt: paywall.updatedAt.toISOString(),
        })),
        team: merchant.ownedTeam.map((member) => ({
            id: member.id,
            role: member.role,
            createdAt: member.createdAt.toISOString(),
            user: member.user ? { name: (member.user as { name?: string }).name || null } : null,
        })),
        settings: {
            webhookConfigured: Boolean(merchant.webhookUrl && merchant.webhookSecret),
            payoutConfigured: Boolean(merchant.payoutAddress),
            onboardingComplete: merchant.onboardingComplete,
        },
    };
}

export async function publishMerchantProfileBundle(merchantId: string) {
    if (!isZeroGEnabled()) {
        return null;
    }

    const [profile, latestArtifact] = await Promise.all([
        buildMerchantProfileBundle(merchantId),
        getLatestArtifact({
            kind: 'merchant_profile',
            localEntityType: 'merchant',
            localEntityId: merchantId,
        }),
    ]);
    if (!profile) {
        return null;
    }

    const payloadHash = sha256Hex(stableJsonStringify(profile));
    if (latestArtifact?.payloadHash === payloadHash && latestArtifact.storageUri) {
        zeroGLogger.info(
            { merchantId, kind: 'merchant_profile', payloadHash },
            'Skipping unchanged 0G merchant profile publish',
        );

        return {
            profile,
            artifact: latestArtifact,
            skipped: true as const,
        };
    }

    const artifact = await publishJson({
        kind: 'merchant_profile',
        payload: profile,
    });

    await prisma.storedArtifact.create({
        data: {
            merchantId,
            kind: 'merchant_profile',
            layer: 'log',
            localEntityType: 'merchant',
            localEntityId: merchantId,
            payloadHash: artifact.payloadHash,
            storageRoot: artifact.storageRoot,
            storageTxHash: artifact.storageTxHash,
            storageUri: artifact.storageUri,
            status: 'published',
            metadata: {
                version: profile.version,
            } as Prisma.InputJsonValue,
        },
    });

    void upsertMutableJson({
            kind: 'merchant_profile',
            streamId: buildZeroGStreamId('merchant', merchantId),
            key: PROFILE_KV_KEY,
            payload: profile,
        }).catch((error) => {
        zeroGLogger.warn({ err: error, merchantId }, 'Merchant profile KV mirror failed');
        });

    return { profile, artifact, skipped: false as const };
}

export async function publishMerchantMemorySnapshot(merchantId: string) {
    if (!isZeroGEnabled()) {
        return null;
    }

    const [memory, latestArtifact] = await Promise.all([
        buildMerchantMemorySnapshot(merchantId),
        getLatestArtifact({
            kind: 'merchant_memory_snapshot',
            localEntityType: 'merchant',
            localEntityId: merchantId,
        }),
    ]);
    if (!memory) {
        return null;
    }

    const payloadHash = sha256Hex(stableJsonStringify(memory));
    const latestLogicalPayloadHash =
        latestArtifact?.metadata &&
        typeof latestArtifact.metadata === 'object' &&
        latestArtifact.metadata !== null &&
        'logicalPayloadHash' in latestArtifact.metadata &&
        typeof (latestArtifact.metadata as Record<string, unknown>).logicalPayloadHash === 'string'
            ? ((latestArtifact.metadata as Record<string, unknown>).logicalPayloadHash as string)
            : latestArtifact?.payloadHash ?? null;

    if (latestLogicalPayloadHash === payloadHash && latestArtifact?.storageUri) {
        zeroGLogger.info(
            { merchantId, kind: 'merchant_memory_snapshot', payloadHash },
            'Skipping unchanged 0G merchant memory publish',
        );

        return {
            memory,
            artifact: latestArtifact,
            skipped: true as const,
        };
    }

    const publishedArtifact = await publishEncryptedJson({
        kind: 'merchant_memory_snapshot',
        payload: memory,
    });
    const logicalArtifact = {
        ...publishedArtifact,
        payloadHash,
    };

    await prisma.storedArtifact.create({
        data: {
            merchantId,
            kind: 'merchant_memory_snapshot',
            layer: 'log',
            localEntityType: 'merchant',
            localEntityId: merchantId,
            payloadHash,
            storageRoot: publishedArtifact.storageRoot,
            storageTxHash: publishedArtifact.storageTxHash,
            storageUri: publishedArtifact.storageUri,
            status: 'published',
            metadata: {
                version: memory.version,
                encrypted: true,
                logicalPayloadHash: payloadHash,
                encryptedPayloadHash: publishedArtifact.payloadHash,
            } as Prisma.InputJsonValue,
        },
    });

    void upsertMutableJson({
            kind: 'merchant_memory_snapshot',
            streamId: buildZeroGStreamId('merchant', merchantId),
            key: MEMORY_POINTER_KV_KEY,
            payload: {
                storageUri: publishedArtifact.storageUri,
                storageRoot: publishedArtifact.storageRoot,
                storageTxHash: publishedArtifact.storageTxHash,
                publishedAt: publishedArtifact.publishedAt,
                logicalPayloadHash: payloadHash,
            },
        }).catch((error) => {
        zeroGLogger.warn({ err: error, merchantId }, 'Merchant memory KV pointer write failed');
        });

    return { memory, artifact: logicalArtifact, skipped: false as const };
}

export async function syncMerchantZeroGArtifacts(merchantId: string) {
    if (!isZeroGEnabled()) {
        return null;
    }

    const profile = await publishMerchantProfileBundle(merchantId)
        .then((value) => ({ status: 'fulfilled' as const, value }))
        .catch(() => ({ status: 'rejected' as const, value: null }));

    const memory = await publishMerchantMemorySnapshot(merchantId)
        .then((value) => ({ status: 'fulfilled' as const, value }))
        .catch(() => ({ status: 'rejected' as const, value: null }));

    return {
        profile: profile.status === 'fulfilled' ? profile.value : null,
        memory: memory.status === 'fulfilled' ? memory.value : null,
    };
}

export async function getMerchantZeroGState(merchantId: string) {
    const [profile, memory, profileArtifact, memoryArtifact] = await Promise.all([
        buildMerchantProfileBundle(merchantId),
        buildMerchantMemorySnapshot(merchantId),
        getLatestArtifact({ kind: 'merchant_profile', localEntityType: 'merchant', localEntityId: merchantId }),
        getLatestArtifact({ kind: 'merchant_memory_snapshot', localEntityType: 'merchant', localEntityId: merchantId }),
    ]);

    return {
        profile,
        memory,
        published: {
            profile: profileArtifact,
            memory: memoryArtifact,
        },
    };
}

export const syncMerchantArtifacts = syncMerchantZeroGArtifacts;

export async function getMerchantMemorySource(merchantId: string) {
    const artifact = await getLatestArtifact({
        kind: 'merchant_memory_snapshot',
        localEntityType: 'merchant',
        localEntityId: merchantId,
    });

    if (artifact?.storageRoot) {
        try {
            const loaded = await withTimeout(
                loadJsonArtifact<MerchantMemorySnapshot>(artifact.storageRoot),
                MERCHANT_MEMORY_READ_TIMEOUT_MS,
                `merchant memory read for ${merchantId}`,
            );
            return {
                snapshot: loaded.payload,
                artifact,
                source: '0g_storage' as const,
                download: loaded.download,
            };
        } catch (error) {
            zeroGLogger.warn({ err: error, merchantId }, 'Failed to load latest 0G merchant memory snapshot');
        }
    }

    const snapshot = await buildMerchantMemorySnapshot(merchantId);
    if (!snapshot) {
        return null;
    }

    return {
        snapshot,
        artifact,
        source: 'local_snapshot' as const,
        download: null,
    };
}

export async function ensureMerchantProfile(merchantId: string) {
    const state = await getMerchantZeroGState(merchantId);

    if (state.profile && state.published.profile) {
        return {
            profile: state.profile,
            artifact: state.published.profile,
            created: false,
        };
    }

    if (state.profile && !isZeroGEnabled()) {
        return {
            profile: state.profile,
            artifact: null,
            created: false,
        };
    }

    if (!isZeroGEnabled()) {
        return null;
    }

    let published = null;
    try {
        published = await publishMerchantProfileBundle(merchantId);
    } catch (error) {
        zeroGLogger.warn({ err: error, merchantId }, 'Falling back to local merchant profile because 0G publication failed');
    }

    if (!published) {
        return state.profile
            ? {
                profile: state.profile,
                artifact: null,
                created: false,
            }
            : null;
    }

    const artifact = await getLatestArtifact({
        kind: 'merchant_profile',
        localEntityType: 'merchant',
        localEntityId: merchantId,
    });

    if (!artifact) {
        return null;
    }

    return {
        profile: published.profile,
        artifact: artifact ?? null,
        created: true,
    };
}
