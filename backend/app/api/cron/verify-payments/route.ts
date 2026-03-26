import { prisma } from "@/lib/prisma";
import { sendWebhook } from "@/lib/webhooks";
import { amountsMatch } from "@/lib/validation";
import { NextResponse } from "next/server";
import { paymentLogger } from '@/lib/logger';
import {
    formatUnits,
    decodeEventLog,
    parseAbi
} from 'viem';
import { publicClient, getSettlementToken, EXPLORER_URL } from '@/lib/chain';
import { sendPaymentConfirmed } from '@/lib/emails/paymentConfirmed';
import { publishVerifiedReceiptProof } from '@/lib/receipts/proof';
import { postDAEvent } from '@/lib/0g/da';
import {
    markSubscriptionInvoicePastDueBySessionId,
    syncSubscriptionAfterConfirmedPayment,
} from '@/lib/subscriptions';

// ─── Chain / Contract config ─────────────────────────────────────────────────
const ERC20_TRANSFER_ABI = parseAbi([
    'event Transfer(address indexed from, address indexed to, uint256 value)'
]);

async function updateFundingIntentResumeState(checkoutSessionId: string, resumeState: string) {
    await prisma.fundingIntent.updateMany({
        where: { checkoutSessionId, provider: 'moonpay' },
        data: { resumeState },
    }).catch(() => null);
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
    // Auth: only allow Vercel Cron or manual calls with CRON_SECRET
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    // Load all sessions currently awaiting verification
    const pending = await prisma.checkoutSession.findMany({
        where: { status: "verifying" },
        include: {
            product: {
                select: {
                    id: true,
                    name: true,
                    description: true,
                    image: true,
                    billingType: true,
                    billingInterval: true,
                    billingIntervalCount: true,
                },
            },
            merchant: {
                select: {
                    id: true,
                    email: true,
                    name: true,
                    payoutAddress: true,
                    webhookSecret: true,
                    webhookUrl: true,
                }
            }
        }
    });

    if (pending.length === 0) {
        return NextResponse.json({ processed: 0, message: "No sessions to verify" });
    }

    paymentLogger.info({ count: pending.length }, 'Cron: verifying sessions');

    const results = { confirmed: 0, failed: 0, expired: 0, pending: 0 };

    for (const session of pending) {
        const txHash = session.pendingTxHash;

        // Expire sessions past deadline
        if (session.expiresAt < now) {
            await prisma.checkoutSession.update({
                where: { id: session.id },
                data: { status: "expired" }
            });
            if (session.paymentMode === 'fund_then_pay') {
                await updateFundingIntentResumeState(session.id, 'funded_but_unsettled');
            }
            await markSubscriptionInvoicePastDueBySessionId(session.id).catch(() => null);
            results.expired++;
            paymentLogger.info({ sessionId: session.id }, 'Session expired');
            continue;
        }

        if (!txHash) {
            // Shouldn't happen, but protect against it
            results.pending++;
            continue;
        }

        try {
            // Try to fetch the receipt — if not mined yet, skip this run
            const receipt = await publicClient.getTransactionReceipt({
                hash: txHash as `0x${string}`
            }).catch(() => null);

            if (!receipt) {
                // Not mined yet — will retry next cron run
                results.pending++;
                paymentLogger.info({ sessionId: session.id, txHash }, 'Tx not yet mined, skipping');
                continue;
            }

            // Transaction reverted
            if (receipt.status !== 'success') {
                await prisma.checkoutSession.update({
                    where: { id: session.id },
                    data: { status: "failed" }
                });
                if (session.paymentMode === 'fund_then_pay') {
                    await updateFundingIntentResumeState(session.id, 'funded_but_unsettled');
                }
                await markSubscriptionInvoicePastDueBySessionId(session.id).catch(() => null);
                results.failed++;
                paymentLogger.warn({ sessionId: session.id, txHash, reason: 'tx_reverted' }, 'Payment verification failed');
                continue;
            }

            // Find the token Transfer event in logs
            const settlementToken = getSettlementToken();
            const contractAddress = settlementToken.address.toLowerCase();
            const transferLog = receipt.logs.find(log => {
                if (log.address.toLowerCase() !== contractAddress) return false;
                try {
                    const decoded = decodeEventLog({
                        abi: ERC20_TRANSFER_ABI,
                        data: log.data,
                        topics: log.topics
                    });
                    return decoded.eventName === 'Transfer';
                } catch {
                    return false;
                }
            });

            if (!transferLog) {
                await prisma.checkoutSession.update({
                    where: { id: session.id },
                    data: { status: "failed" }
                });
                if (session.paymentMode === 'fund_then_pay') {
                    await updateFundingIntentResumeState(session.id, 'funded_but_unsettled');
                }
                await markSubscriptionInvoicePastDueBySessionId(session.id).catch(() => null);
                results.failed++;
                paymentLogger.warn({ sessionId: session.id, txHash, reason: 'no_transfer_event' }, 'Payment verification failed');
                continue;
            }

            const decoded = decodeEventLog({
                abi: ERC20_TRANSFER_ABI,
                data: transferLog.data,
                topics: transferLog.topics
            });

            const transferFrom = (decoded.args as any).from as string;
            const transferTo   = (decoded.args as any).to as string;
            const transferAmount = (decoded.args as any).value as bigint;

            // Verify recipient
            const expectedRecipient = session.merchant.payoutAddress?.toLowerCase();
            if (!expectedRecipient || transferTo.toLowerCase() !== expectedRecipient) {
                await prisma.checkoutSession.update({
                    where: { id: session.id },
                    data: { status: "failed" }
                });
                if (session.paymentMode === 'fund_then_pay') {
                    await updateFundingIntentResumeState(session.id, 'funded_but_unsettled');
                }
                await markSubscriptionInvoicePastDueBySessionId(session.id).catch(() => null);
                results.failed++;
                paymentLogger.warn({ sessionId: session.id, txHash, reason: 'recipient_mismatch' }, 'Payment verification failed');
                continue;
            }

            // Verify amount (BigInt, no floating point)
            if (!amountsMatch(transferAmount, session.amount.toString(), settlementToken.decimals)) {
                await prisma.checkoutSession.update({
                    where: { id: session.id },
                    data: { status: "failed" }
                });
                if (session.paymentMode === 'fund_then_pay') {
                    await updateFundingIntentResumeState(session.id, 'funded_but_unsettled');
                }
                await markSubscriptionInvoicePastDueBySessionId(session.id).catch(() => null);
                results.failed++;
                paymentLogger.warn({ sessionId: session.id, txHash, reason: 'amount_mismatch', onChain: formatUnits(transferAmount, settlementToken.decimals), expected: session.amount.toString() }, 'Payment verification failed');
                continue;
            }

            const formattedAmount = formatUnits(transferAmount, settlementToken.decimals);
            const confirmedAt = new Date();

            // All checks passed — confirm the session and upsert the transaction atomically.
            await prisma.$transaction(async (tx) => {
                await tx.transaction.upsert({
                    where: { txHash },
                    update: {
                        checkoutId: session.id,
                        from: transferFrom,
                        to: transferTo,
                        amount: formattedAmount,
                        token: settlementToken.symbol,
                        status: "confirmed",
                        blockNumber: Number(receipt.blockNumber),
                    },
                    create: {
                        checkoutId: session.id,
                        txHash,
                        from: transferFrom,
                        to: transferTo,
                        amount: formattedAmount,
                        token: settlementToken.symbol,
                        status: "confirmed",
                        blockNumber: Number(receipt.blockNumber),
                    },
                });

                await tx.checkoutSession.update({
                    where: { id: session.id },
                    data: { status: "confirmed", txHash }
                });
            });
            if (session.paymentMode === 'fund_then_pay') {
                await updateFundingIntentResumeState(session.id, 'settled');
            }

            let zeroGReceiptProof: Awaited<ReturnType<typeof publishVerifiedReceiptProof>> | null = null;
            try {
                zeroGReceiptProof = await publishVerifiedReceiptProof({
                    session,
                    merchant: session.merchant,
                    transaction: {
                        txHash,
                        from: transferFrom,
                        to: transferTo,
                        amount: formattedAmount,
                        blockNumber: Number(receipt.blockNumber),
                        confirmedAt,
                        status: 'confirmed',
                    },
                });
            } catch (zeroGError) {
                paymentLogger.warn(
                    { err: zeroGError, sessionId: session.id, txHash },
                    '0G receipt publication failed without affecting settlement confirmation',
                );
            }

            // Post payment confirmation to 0G DA (fire-and-forget)
            void postDAEvent('payment_confirmed', session.merchant.id, {
                checkoutSessionId: session.id,
                txHash,
                amount: formattedAmount,
                currency: session.currency,
                from: transferFrom,
                to: transferTo,
                blockNumber: Number(receipt.blockNumber),
                zeroGStorageUri: zeroGReceiptProof && !zeroGReceiptProof.skipped
                    ? zeroGReceiptProof.artifact.storageUri
                    : null,
                zeroGAnchorTxHash: zeroGReceiptProof && !zeroGReceiptProof.skipped
                    ? zeroGReceiptProof.anchor?.anchorTxHash ?? null
                    : null,
            });

            const metadata = session.metadata && typeof session.metadata === 'object'
                ? (session.metadata as Record<string, unknown>)
                : null;
            const paywallId = typeof metadata?.paywallId === 'string' ? metadata.paywallId : null;
            const payerAddress = typeof metadata?.payerAddress === 'string' ? metadata.payerAddress : null;

            if (paywallId && payerAddress) {
                // Look up the paywall's accessDuration for expiration
                const paywall = await prisma.paywall.findUnique({
                    where: { id: paywallId },
                    select: { accessDuration: true },
                });
                const expiresAt = paywall?.accessDuration
                    ? new Date(Date.now() + paywall.accessDuration * 1000)
                    : null;

                await prisma.paywallAccess.upsert({
                    where: {
                        paywallId_address: {
                            paywallId,
                            address: payerAddress,
                        },
                    },
                    update: {
                        accessCount: { increment: 1 },
                        txHash,
                        ...(expiresAt && { expiresAt }),
                    },
                    create: {
                        paywallId,
                        address: payerAddress,
                        txHash,
                        accessCount: 1,
                        expiresAt,
                    },
                });
            }

            // Increment payment link useCount if this session came from a link
            const paymentLinkId = typeof metadata?.linkId === 'string' ? metadata.linkId : null;
            if (paymentLinkId) {
                await prisma.paymentLink.update({
                    where: { id: paymentLinkId },
                    data: { useCount: { increment: 1 } },
                }).catch(() => null);
            }

            try {
                await syncSubscriptionAfterConfirmedPayment({
                    session,
                    product: session.product,
                    paidAt: new Date(),
                    customerAddress: session.customerAddress || payerAddress || transferFrom,
                    customerEmail:
                        session.customerEmail ||
                        (typeof metadata?.customerEmail === 'string' ? metadata.customerEmail : null),
                });
            } catch (subscriptionError) {
                paymentLogger.warn(
                    { err: subscriptionError, sessionId: session.id, txHash },
                    'Subscription sync failed after payment confirmation',
                );
            }

            // Fire webhook — use callbackUrl if set, else merchant's default webhookUrl
            const webhookUrl = session.callbackUrl || session.merchant.webhookUrl;
            const webhookSecret = session.merchant.webhookSecret;
            if (webhookUrl && webhookSecret) {
                await sendWebhook(webhookUrl, {
                    event: "checkout.session.completed",
                    data: {
                        id: session.id,
                        amount: session.amount,
                        currency: session.currency,
                        status: "confirmed",
                        txHash,
                        customerEmail: session.customerEmail,
                        payerInfo: session.payerInfo,
                        explorerUrl: `${EXPLORER_URL}/tx/${txHash}`,
                        zeroG:
                            zeroGReceiptProof && !zeroGReceiptProof.skipped
                                ? {
                                    storageUri: zeroGReceiptProof.artifact.storageUri,
                                    storageRoot: zeroGReceiptProof.artifact.storageRoot,
                                    storageTxHash: zeroGReceiptProof.artifact.storageTxHash,
                                    anchorTxHash: zeroGReceiptProof.anchor?.anchorTxHash || null,
                                }
                                : null,
                    }
                }, webhookSecret, session.merchant.id);
            } else if (webhookUrl && !webhookSecret) {
                paymentLogger.warn({ sessionId: session.id, merchantId: session.merchant.id }, 'No webhook secret — skipping unsigned webhook');
            }

            // Send payment confirmed email to merchant (fire-and-forget)
            if (session.merchant.email) {
                sendPaymentConfirmed({
                    merchantEmail: session.merchant.email,
                    merchantName: session.merchant.name || 'Merchant',
                    amount: formattedAmount,
                    currency: settlementToken.symbol,
                    txHash,
                    explorerUrl: `${EXPLORER_URL}/tx/${txHash}`,
                }).catch((e) => paymentLogger.warn({ e }, 'Failed to send payment confirmed email'));
            }

            results.confirmed++;
            paymentLogger.info({ sessionId: session.id, txHash, amount: formattedAmount }, 'Payment confirmed');

        } catch (err) {
            paymentLogger.error({ err, sessionId: session.id }, 'Error processing session');
            results.pending++; // Leave as verifying, retry next run
        }
    }

    paymentLogger.info({ results }, 'Cron run complete');
    return NextResponse.json({ processed: pending.length, results });
}
