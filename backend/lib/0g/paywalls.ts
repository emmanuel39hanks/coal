import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { zeroGLogger } from '@/lib/logger';
import { buildZeroGStreamId, getLatestArtifact } from '@/lib/0g/catalog';
import { isZeroGEnabled } from '@/lib/0g/env';
import { publishJson, sha256Hex, stableJsonStringify, upsertMutableJson } from '@/lib/0g/storage';
import type { PaywallManifest } from '@/lib/0g/types';
import { CHAIN_ID, getSettlementToken } from '@/lib/chain';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function loadPaywallContext(paywallId: string) {
    return prisma.paywall.findUnique({
        where: { id: paywallId },
        include: {
            merchant: {
                select: {
                    id: true,
                    name: true,
                    payoutAddress: true,
                },
            },
        },
    });
}

export async function buildPaywallManifest(paywallId: string): Promise<PaywallManifest | null> {
    const paywall = await loadPaywallContext(paywallId);
    if (!paywall) {
        return null;
    }

    const settlementToken = getSettlementToken();
    const profileArtifact = await getLatestArtifact({
        kind: 'merchant_profile',
        localEntityType: 'merchant',
        localEntityId: paywall.merchantId,
    });

    return {
        version: 'coal.paywall_manifest.v1',
        paywallId: paywall.id,
        merchantId: paywall.merchantId,
        merchantName: paywall.merchant.name,
        name: paywall.name,
        description: paywall.description,
        price: paywall.price.toString(),
        currency: paywall.currency,
        contentType: paywall.contentType,
        pricingModel: paywall.pricingModel,
        active: paywall.active,
        contentUrl: paywall.contentUrl,
        recipient: paywall.merchant.payoutAddress,
        network: {
            id: CHAIN_ID,
            name: 'base',
        },
        settlementToken: {
            address: settlementToken.address,
            symbol: settlementToken.symbol,
            name: settlementToken.name,
            decimals: settlementToken.decimals,
        },
        entitlement: {
            type: 'wallet_access',
            supportedSubjects: ['wallet'],
        },
        payment: {
            verifyUrl: `${API_BASE_URL}/api/paywalls/${paywall.id}/verify`,
            payUrl: `${API_BASE_URL}/api/paywalls/${paywall.id}/pay`,
            payIntentUrl: `${API_BASE_URL}/api/agent/paywalls/${paywall.id}/pay-intent`,
            receiptVerifyUrlTemplate: `${API_BASE_URL}/api/agent/receipts/{checkoutId}/verify`,
        },
        merchantProfile: profileArtifact
            ? {
                storageUri: profileArtifact.storageUri ?? null,
                storageRoot: profileArtifact.storageRoot ?? null,
            }
            : null,
        createdAt: paywall.createdAt.toISOString(),
        updatedAt: paywall.updatedAt.toISOString(),
    };
}

export async function publishPaywallManifest(paywallId: string) {
    if (!isZeroGEnabled()) {
        return null;
    }

    const [manifest, latestArtifact] = await Promise.all([
        buildPaywallManifest(paywallId),
        getLatestArtifact({
            kind: 'paywall_manifest',
            localEntityType: 'paywall',
            localEntityId: paywallId,
        }),
    ]);
    if (!manifest) {
        return null;
    }

    const payloadHash = sha256Hex(stableJsonStringify(manifest));
    if (latestArtifact?.payloadHash === payloadHash && latestArtifact.storageUri) {
        zeroGLogger.info(
            { paywallId, kind: 'paywall_manifest', payloadHash },
            'Skipping unchanged 0G paywall manifest publish',
        );

        return {
            manifest,
            artifact: latestArtifact,
            skipped: true as const,
        };
    }

    const artifact = await publishJson({
        kind: 'paywall_manifest',
        payload: manifest,
    });

    await prisma.storedArtifact.create({
        data: {
            merchantId: manifest.merchantId,
            kind: 'paywall_manifest',
            layer: 'log',
            localEntityType: 'paywall',
            localEntityId: paywallId,
            payloadHash,
            storageRoot: artifact.storageRoot,
            storageTxHash: artifact.storageTxHash,
            storageUri: artifact.storageUri,
            status: 'published',
            metadata: {
                version: manifest.version,
            } as Prisma.InputJsonValue,
        },
    });

    try {
        await upsertMutableJson({
            kind: 'paywall_manifest',
            streamId: buildZeroGStreamId('merchant', manifest.merchantId),
            key: `paywall:${paywallId}:manifest:latest`,
            payload: manifest,
        });
    } catch (error) {
        zeroGLogger.warn({ err: error, paywallId }, 'Paywall manifest KV mirror failed');
    }

    return { manifest, artifact, skipped: false as const };
}

export async function getPaywallZeroGState(paywallId: string) {
    const [manifest, artifact] = await Promise.all([
        buildPaywallManifest(paywallId),
        getLatestArtifact({
            kind: 'paywall_manifest',
            localEntityType: 'paywall',
            localEntityId: paywallId,
        }),
    ]);

    return { manifest, published: artifact };
}

export async function ensurePaywallManifest(paywallId: string) {
    const state = await getPaywallZeroGState(paywallId);

    if (state.manifest && state.published) {
        return {
            manifest: state.manifest,
            artifact: state.published,
            created: false,
        };
    }

    if (state.manifest && !isZeroGEnabled()) {
        return {
            manifest: state.manifest,
            artifact: null,
            created: false,
        };
    }

    if (!isZeroGEnabled()) {
        return null;
    }

    let published = null;
    try {
        published = await publishPaywallManifest(paywallId);
    } catch (error) {
        zeroGLogger.warn({ err: error, paywallId }, 'Falling back to local paywall manifest because 0G publication failed');
    }

    if (!published) {
        return state.manifest
            ? {
                manifest: state.manifest,
                artifact: null,
                created: false,
            }
            : null;
    }

    const artifact = await getLatestArtifact({
        kind: 'paywall_manifest',
        localEntityType: 'paywall',
        localEntityId: paywallId,
    });

    if (!artifact) {
        return null;
    }

    return {
        manifest: published.manifest,
        artifact: artifact ?? null,
        created: true,
    };
}
