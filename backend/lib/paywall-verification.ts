import { prisma } from '@/lib/prisma';
import { CHAIN_ID, getSettlementToken } from '@/lib/chain';
import { getPaywallZeroGState } from '@/lib/0g/paywalls';
import { buildPaymentRequirements } from '@/lib/x402';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.usecoal.xyz';

export async function getPaywallVerificationState(input: {
    paywallId: string;
    address?: string | null;
    did?: string | null;
    agentId?: string | null;
}) {
    const paywall = await prisma.paywall.findUnique({
        where: { id: input.paywallId },
        include: { merchant: { select: { payoutAddress: true } } },
    });

    if (!paywall || !paywall.active) {
        return null;
    }

    const paywallState = await getPaywallZeroGState(input.paywallId).catch(() => null);
    const settlementToken = getSettlementToken();
    const subjectRef = input.address || input.did || input.agentId || null;
    const subjectType = input.address ? 'wallet' : input.did ? 'did' : input.agentId ? 'agent' : 'unknown';

    const zeroG = {
        manifestPublished: Boolean(paywallState?.published),
        manifestUri: paywallState?.published?.storageUri ?? null,
        manifestRoot: paywallState?.published?.storageRoot ?? null,
        manifestPayloadHash: paywallState?.published?.payloadHash ?? null,
    };

    let access = null;
    if (input.address) {
        access = await prisma.paywallAccess.findUnique({
            where: {
                paywallId_address: {
                    paywallId: input.paywallId,
                    address: input.address,
                },
            },
        });
    }

    if (access) {
        // Check if access has been revoked
        if (access.revokedAt) {
            return {
                paywall,
                manifest: paywallState?.manifest ?? null,
                paid: false as const,
                revoked: true,
                body: {
                    paid: false,
                    revoked: true,
                    paywallId: paywall.id,
                    name: paywall.name,
                    description: paywall.description,
                    price: paywall.price.toString(),
                    currency: paywall.currency,
                    entitlement: {
                        type: 'wallet_access',
                        subjectType,
                        subjectRef,
                        accessCount: access.accessCount,
                        txHash: access.txHash,
                    },
                    zeroG,
                    paymentMethods: [
                        {
                            type: 'coal-native',
                            network: 'base',
                            chainId: CHAIN_ID,
                            token: settlementToken.address,
                            symbol: settlementToken.symbol,
                            recipient: paywall.merchant.payoutAddress,
                            amount: paywall.price.toString(),
                        },
                        {
                            type: 'x402',
                            scheme: 'exact',
                            network: `eip155:${CHAIN_ID}`,
                            requirements: buildPaymentRequirements({
                                id: paywall.id,
                                price: paywall.price,
                                currency: paywall.currency,
                                name: paywall.name,
                                description: paywall.description,
                                merchant: paywall.merchant,
                            }),
                        },
                    ],
                    payment: {
                        payUrl: `${API_BASE_URL}/api/paywalls/${paywall.id}/pay`,
                        payIntentUrl: `${API_BASE_URL}/api/agent/paywalls/${paywall.id}/pay-intent`,
                        manifestUrl: `${API_BASE_URL}/api/agent/paywalls/${paywall.id}/manifest`,
                        receiptVerifyUrlTemplate: `${API_BASE_URL}/api/agent/receipts/{checkoutId}/verify`,
                    },
                },
            };
        }

        // Check if access has expired
        if (access.expiresAt && access.expiresAt < new Date()) {
            return {
                paywall,
                manifest: paywallState?.manifest ?? null,
                paid: false as const,
                expired: true,
                body: {
                    paid: false,
                    expired: true,
                    paywallId: paywall.id,
                    name: paywall.name,
                    description: paywall.description,
                    price: paywall.price.toString(),
                    currency: paywall.currency,
                    entitlement: {
                        type: 'wallet_access',
                        subjectType,
                        subjectRef,
                        accessCount: access.accessCount,
                        txHash: access.txHash,
                    },
                    zeroG,
                    paymentMethods: [
                        {
                            type: 'coal-native',
                            network: 'base',
                            chainId: CHAIN_ID,
                            token: settlementToken.address,
                            symbol: settlementToken.symbol,
                            recipient: paywall.merchant.payoutAddress,
                            amount: paywall.price.toString(),
                        },
                        {
                            type: 'x402',
                            scheme: 'exact',
                            network: `eip155:${CHAIN_ID}`,
                            requirements: buildPaymentRequirements({
                                id: paywall.id,
                                price: paywall.price,
                                currency: paywall.currency,
                                name: paywall.name,
                                description: paywall.description,
                                merchant: paywall.merchant,
                            }),
                        },
                    ],
                    payment: {
                        payUrl: `${API_BASE_URL}/api/paywalls/${paywall.id}/pay`,
                        payIntentUrl: `${API_BASE_URL}/api/agent/paywalls/${paywall.id}/pay-intent`,
                        manifestUrl: `${API_BASE_URL}/api/agent/paywalls/${paywall.id}/manifest`,
                        receiptVerifyUrlTemplate: `${API_BASE_URL}/api/agent/receipts/{checkoutId}/verify`,
                    },
                },
            };
        }

        // Check per-call quota
        if (paywall.pricingModel === 'per_call' && paywall.callQuota && access.accessCount >= paywall.callQuota) {
            return {
                paywall,
                manifest: paywallState?.manifest ?? null,
                paid: false as const,
                quotaExceeded: true,
                body: {
                    paid: false,
                    quotaExceeded: true,
                    paywallId: paywall.id,
                    name: paywall.name,
                    description: paywall.description,
                    price: paywall.price.toString(),
                    currency: paywall.currency,
                    entitlement: {
                        type: 'wallet_access',
                        subjectType,
                        subjectRef,
                        accessCount: access.accessCount,
                        callQuota: paywall.callQuota,
                        txHash: access.txHash,
                    },
                    zeroG,
                    paymentMethods: [
                        {
                            type: 'coal-native',
                            network: 'base',
                            chainId: CHAIN_ID,
                            token: settlementToken.address,
                            symbol: settlementToken.symbol,
                            recipient: paywall.merchant.payoutAddress,
                            amount: paywall.price.toString(),
                        },
                        {
                            type: 'x402',
                            scheme: 'exact',
                            network: `eip155:${CHAIN_ID}`,
                            requirements: buildPaymentRequirements({
                                id: paywall.id,
                                price: paywall.price,
                                currency: paywall.currency,
                                name: paywall.name,
                                description: paywall.description,
                                merchant: paywall.merchant,
                            }),
                        },
                    ],
                    payment: {
                        payUrl: `${API_BASE_URL}/api/paywalls/${paywall.id}/pay`,
                        payIntentUrl: `${API_BASE_URL}/api/agent/paywalls/${paywall.id}/pay-intent`,
                        manifestUrl: `${API_BASE_URL}/api/agent/paywalls/${paywall.id}/manifest`,
                        receiptVerifyUrlTemplate: `${API_BASE_URL}/api/agent/receipts/{checkoutId}/verify`,
                    },
                },
            };
        }

        return {
            paywall,
            manifest: paywallState?.manifest ?? null,
            paid: true as const,
            body: {
                paid: true,
                paywallId: paywall.id,
                name: paywall.name,
                description: paywall.description,
                price: paywall.price.toString(),
                currency: paywall.currency,
                content: paywall.contentData,
                contentUrl: paywall.contentUrl,
                entitlement: {
                    type: 'wallet_access',
                    subjectType,
                    subjectRef,
                    accessCount: access.accessCount,
                    txHash: access.txHash,
                },
                zeroG,
            },
        };
    }

    return {
        paywall,
        manifest: paywallState?.manifest ?? null,
        paid: false as const,
        body: {
            paid: false,
            paywallId: paywall.id,
            name: paywall.name,
            description: paywall.description,
            price: paywall.price.toString(),
            currency: paywall.currency,
            entitlement: {
                type: 'wallet_access',
                subjectType,
                subjectRef,
                accessCount: 0,
                txHash: null,
            },
            zeroG,
            paymentMethods: [
                {
                    type: 'coal-native',
                    network: 'base',
                    chainId: CHAIN_ID,
                    token: settlementToken.address,
                    symbol: settlementToken.symbol,
                    recipient: paywall.merchant.payoutAddress,
                    amount: paywall.price.toString(),
                },
                {
                    type: 'x402',
                    scheme: 'exact',
                    network: `eip155:${CHAIN_ID}`,
                    requirements: buildPaymentRequirements({
                        id: paywall.id,
                        price: paywall.price,
                        currency: paywall.currency,
                        name: paywall.name,
                        description: paywall.description,
                        merchant: paywall.merchant,
                    }),
                },
            ],
            payment: {
                payUrl: `${API_BASE_URL}/api/paywalls/${paywall.id}/pay`,
                payIntentUrl: `${API_BASE_URL}/api/agent/paywalls/${paywall.id}/pay-intent`,
                manifestUrl: `${API_BASE_URL}/api/agent/paywalls/${paywall.id}/manifest`,
                receiptVerifyUrlTemplate: `${API_BASE_URL}/api/agent/receipts/{checkoutId}/verify`,
            },
        },
    };
}
