import { prisma } from '@/lib/prisma';
import { paymentLogger } from '@/lib/logger';
import { amountsMatch } from '@/lib/validation';
import { formatUnits, decodeEventLog, parseAbi } from 'viem';
import { publicClient, getSettlementToken, EXPLORER_URL } from '@/lib/chain';
import { getChainByKey, getPublicClient, resolveChainKey, type SupportedChainKey } from '@/lib/chains';
import { checkSanctions } from '@/lib/sanctions';
import { publishVerifiedReceiptProof } from '@/lib/receipts/proof';
import { postDAEvent } from '@/lib/0g/da';
import { sendPaymentConfirmed } from '@/lib/emails/paymentConfirmed';
import { sendWebhook } from '@/lib/webhooks';
import {
    markSubscriptionInvoicePastDueBySessionId,
    syncSubscriptionAfterConfirmedPayment,
} from '@/lib/subscriptions';

const ERC20_TRANSFER_ABI = parseAbi([
    'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

async function updateFundingIntentResumeState(checkoutSessionId: string, resumeState: string) {
    await prisma.fundingIntent.updateMany({
        where: { checkoutSessionId, provider: 'moonpay' },
        data: { resumeState },
    }).catch(() => null);
}

/**
 * Verify a single verifying session directly (no HTTP self-call).
 * Returns the new status: 'confirmed', 'failed', 'expired', or 'verifying' (not yet ready).
 */
export async function verifyPendingSession(sessionId: string): Promise<string> {
    const now = new Date();

    const session = await prisma.checkoutSession.findUnique({
        where: { id: sessionId },
        include: {
            product: {
                select: {
                    id: true, name: true, description: true, image: true,
                    billingType: true, billingInterval: true, billingIntervalCount: true,
                },
            },
            merchant: {
                select: {
                    id: true, email: true, name: true,
                    payoutAddress: true, webhookSecret: true, webhookUrl: true,
                },
            },
        },
    });

    if (!session || session.status !== 'verifying') return session?.status ?? 'verifying';

    const txHash = session.pendingTxHash;
    if (!txHash) return 'verifying';

    if (session.expiresAt < now) {
        await prisma.checkoutSession.update({ where: { id: sessionId }, data: { status: 'expired' } });
        await markSubscriptionInvoicePastDueBySessionId(sessionId).catch(() => null);
        return 'expired';
    }

    const chainKey: SupportedChainKey = resolveChainKey(session.settlementChain);
    const chainCfg = getChainByKey(chainKey);
    const chainClient = chainKey === 'base' ? publicClient : getPublicClient(chainKey);
    const settlementToken = chainKey === 'base' ? getSettlementToken() : chainCfg.usdc;
    const explorerBaseUrl = chainKey === 'base' ? EXPLORER_URL : chainCfg.explorerUrl;

    try {
        const receipt = await chainClient.getTransactionReceipt({
            hash: txHash as `0x${string}`,
        }).catch(() => null);

        if (!receipt) {
            paymentLogger.info({ sessionId, txHash, chain: chainKey }, 'Tx not yet mined');
            return 'verifying';
        }

        const MIN_CONFIRMATIONS = 2;
        const currentBlock = await chainClient.getBlockNumber().catch(() => null);
        if (currentBlock && receipt.blockNumber + BigInt(MIN_CONFIRMATIONS) > currentBlock) {
            return 'verifying';
        }

        if (receipt.status !== 'success') {
            await prisma.checkoutSession.update({ where: { id: sessionId }, data: { status: 'failed' } });
            await markSubscriptionInvoicePastDueBySessionId(sessionId).catch(() => null);
            return 'failed';
        }

        const contractAddress = settlementToken.address.toLowerCase();
        const transferLog = receipt.logs.find(log => {
            if (log.address.toLowerCase() !== contractAddress) return false;
            try {
                const decoded = decodeEventLog({ abi: ERC20_TRANSFER_ABI, data: log.data, topics: log.topics });
                return decoded.eventName === 'Transfer';
            } catch { return false; }
        });

        if (!transferLog) {
            await prisma.checkoutSession.update({ where: { id: sessionId }, data: { status: 'failed' } });
            await markSubscriptionInvoicePastDueBySessionId(sessionId).catch(() => null);
            paymentLogger.warn({ sessionId, txHash, reason: 'no_transfer_event' }, 'Payment verification failed');
            return 'failed';
        }

        const decoded = decodeEventLog({ abi: ERC20_TRANSFER_ABI, data: transferLog.data, topics: transferLog.topics });
        const transferFrom = (decoded.args as any).from as string;
        const transferTo = (decoded.args as any).to as string;
        const transferAmount = (decoded.args as any).value as bigint;

        const sanctionsResult = await checkSanctions([transferFrom, transferTo].filter(Boolean));
        if (sanctionsResult.sanctioned) {
            await prisma.checkoutSession.update({ where: { id: sessionId }, data: { status: 'failed' } });
            await markSubscriptionInvoicePastDueBySessionId(sessionId).catch(() => null);
            paymentLogger.warn({ sessionId, txHash, reason: 'sanctioned_address' }, 'Payment blocked: sanctioned address');
            return 'failed';
        }

        const sessionMetadata = session.metadata && typeof session.metadata === 'object'
            ? (session.metadata as Record<string, unknown>) : null;
        const snapshotAddress = typeof sessionMetadata?.snapshotPayoutAddress === 'string'
            ? sessionMetadata.snapshotPayoutAddress : null;
        const expectedRecipient = (snapshotAddress || session.merchant.payoutAddress)?.toLowerCase();
        if (!expectedRecipient || transferTo.toLowerCase() !== expectedRecipient) {
            await prisma.checkoutSession.update({ where: { id: sessionId }, data: { status: 'failed' } });
            await markSubscriptionInvoicePastDueBySessionId(sessionId).catch(() => null);
            paymentLogger.warn({ sessionId, txHash, reason: 'recipient_mismatch', expected: expectedRecipient, got: transferTo }, 'Payment verification failed');
            return 'failed';
        }

        if (!amountsMatch(transferAmount, session.amount.toString(), settlementToken.decimals)) {
            await prisma.checkoutSession.update({ where: { id: sessionId }, data: { status: 'failed' } });
            await markSubscriptionInvoicePastDueBySessionId(sessionId).catch(() => null);
            paymentLogger.warn({ sessionId, txHash, reason: 'amount_mismatch' }, 'Payment verification failed');
            return 'failed';
        }

        const formattedAmount = formatUnits(transferAmount, settlementToken.decimals);
        const confirmedAt = new Date();

        await prisma.$transaction(async (tx) => {
            const fresh = await tx.checkoutSession.findUnique({ where: { id: sessionId }, select: { status: true } });
            if (fresh?.status !== 'verifying') throw new Error('SESSION_ALREADY_PROCESSED');
            await tx.transaction.upsert({
                where: { txHash },
                update: { checkoutId: sessionId, from: transferFrom, to: transferTo, amount: formattedAmount, token: settlementToken.symbol, status: 'confirmed', blockNumber: Number(receipt.blockNumber), chainId: chainCfg.chainId },
                create: { checkoutId: sessionId, txHash, from: transferFrom, to: transferTo, amount: formattedAmount, token: settlementToken.symbol, status: 'confirmed', blockNumber: Number(receipt.blockNumber), chainId: chainCfg.chainId },
            });
            await tx.checkoutSession.update({ where: { id: sessionId }, data: { status: 'confirmed', txHash } });
        });

        paymentLogger.info({ sessionId, txHash, amount: formattedAmount }, 'Payment confirmed');

        // Post-confirmation side effects (all fire-and-forget — don't block the status response)
        void Promise.resolve().then(async () => {
            try {
                const zeroGReceiptProof = await publishVerifiedReceiptProof({
                    session, merchant: session.merchant,
                    transaction: { txHash, from: transferFrom, to: transferTo, amount: formattedAmount, blockNumber: Number(receipt.blockNumber), confirmedAt, status: 'confirmed' },
                }).catch(() => null);

                void postDAEvent('payment_confirmed', session.merchant.id, {
                    checkoutSessionId: sessionId, txHash, amount: formattedAmount, currency: session.currency,
                    from: transferFrom, to: transferTo, blockNumber: Number(receipt.blockNumber),
                    zeroGStorageUri: zeroGReceiptProof && !zeroGReceiptProof.skipped ? zeroGReceiptProof.artifact.storageUri : null,
                    zeroGAnchorTxHash: zeroGReceiptProof && !zeroGReceiptProof.skipped ? zeroGReceiptProof.anchor?.anchorTxHash ?? null : null,
                });

                const metadata = session.metadata && typeof session.metadata === 'object' ? (session.metadata as Record<string, unknown>) : null;
                const paymentLinkId = typeof metadata?.linkId === 'string' ? metadata.linkId : null;
                if (paymentLinkId) {
                    await prisma.paymentLink.update({ where: { id: paymentLinkId }, data: { useCount: { increment: 1 } } }).catch(() => null);
                }

                await syncSubscriptionAfterConfirmedPayment({
                    session, product: session.product, paidAt: new Date(),
                    customerAddress: session.customerAddress || (typeof metadata?.payerAddress === 'string' ? metadata.payerAddress : null) || transferFrom,
                    customerEmail: session.customerEmail || (typeof metadata?.customerEmail === 'string' ? metadata.customerEmail : null),
                }).catch(() => null);

                const webhookUrl = session.callbackUrl || session.merchant.webhookUrl;
                if (webhookUrl && session.merchant.webhookSecret) {
                    await sendWebhook(webhookUrl, {
                        event: 'checkout.session.completed',
                        data: { id: sessionId, amount: session.amount, currency: session.currency, status: 'confirmed', txHash, chain: chainKey, chainId: chainCfg.chainId, explorerUrl: `${explorerBaseUrl}/tx/${txHash}` },
                    }, session.merchant.webhookSecret, session.merchant.id);
                }

                if (session.merchant.email) {
                    await sendPaymentConfirmed({ merchantEmail: session.merchant.email, merchantName: session.merchant.name || 'Merchant', amount: formattedAmount, currency: settlementToken.symbol, txHash, explorerUrl: `${explorerBaseUrl}/tx/${txHash}` }).catch(() => null);
                }
            } catch (e) {
                paymentLogger.warn({ err: e, sessionId }, 'Post-confirmation side effect failed');
            }
        });

        return 'confirmed';
    } catch (err) {
        if (err instanceof Error && err.message === 'SESSION_ALREADY_PROCESSED') return 'confirmed';
        paymentLogger.error({ err, sessionId }, 'Error verifying session');
        return 'verifying';
    }
}
