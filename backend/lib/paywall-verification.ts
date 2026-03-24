import { prisma } from '@/lib/prisma';
import { CHAIN_ID, getSettlementToken } from '@/lib/chain';
import { getPaywallZeroGState } from '@/lib/0g/paywalls';

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
                    facilitator: API_BASE_URL,
                    paymentUrl: `${API_BASE_URL}/api/paywalls/${paywall.id}/pay`,
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
