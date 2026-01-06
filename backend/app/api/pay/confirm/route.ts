import { prisma } from "@/lib/prisma";
import { sendWebhook } from "@/lib/webhooks";
import { NextResponse } from "next/server";
import { createPublicClient, http, formatUnits, decodeEventLog, parseAbi } from 'viem';
import { mainnet } from 'viem/chains';

// MNEE Contract Details
const MNEE_CONTRACT_ADDRESS = '0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF'.toLowerCase();
const MNEE_DECIMALS = 18;

// ERC-20 Transfer event ABI
const ERC20_TRANSFER_ABI = parseAbi([
    'event Transfer(address indexed from, address indexed to, uint256 value)'
]);

// Alchemy RPC endpoint (reliable and fast)
const ALCHEMY_RPC_URL = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;

const publicClient = createPublicClient({
    chain: mainnet,
    transport: http(ALCHEMY_RPC_URL)
});

// Retry helper with fixed delay (for slow networks/pending transactions)
async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 15,      // 15 retries = up to 5+ minutes
    delayMs: number = 20000       // 20 seconds between each retry
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (e) {
            lastError = e as Error;

            const isRetryable =
                lastError.message.includes('not found') ||
                lastError.message.includes('could not be found') ||
                lastError.message.includes('pending') ||
                lastError.message.includes('not be processed');

            if (!isRetryable || attempt === maxRetries - 1) {
                throw e;
            }

            console.log(`Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delayMs / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    throw lastError;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { sessionId, txHash } = body;

        if (!sessionId || !txHash) {
            return NextResponse.json({ error: "Session ID and TxHash required" }, { status: 400 });
        }

        // 1. Get Session & Validate
        const session = await prisma.checkoutSession.findUnique({
            where: { id: sessionId },
            include: {
                merchant: {
                    include: {
                        apiKeys: { take: 1 }
                    }
                }
            }
        });

        if (!session) {
            return NextResponse.json({ error: "Session not found" }, { status: 404 });
        }

        // 2. Verify Transaction using Alchemy RPC
        let receipt;
        let transferAmount: bigint = BigInt(0);
        let transferTo: string = '';
        let transferFrom: string = '';

        try {
            // Wait for transaction to be mined (longer wait for slow networks)
            console.log('Waiting 50s for transaction to be mined...');
            await new Promise(resolve => setTimeout(resolve, 50000));

            receipt = await withRetry(async () => {
                // Get transaction receipt using Alchemy RPC
                const rcpt = await publicClient.getTransactionReceipt({
                    hash: txHash as `0x${string}`
                });

                if (!rcpt) {
                    throw new Error('Transaction receipt not found');
                }

                return rcpt;
            }, 15, 20000); // 15 retries, 20s between each

            if (receipt.status !== 'success') {
                return NextResponse.json({ error: "Transaction reverted on-chain" }, { status: 400 });
            }

            // Parse ERC-20 Transfer event from logs
            const transferLog = receipt.logs.find(log => {
                try {
                    if (log.address.toLowerCase() !== MNEE_CONTRACT_ADDRESS) {
                        return false;
                    }
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
                return NextResponse.json({ error: "No MNEE transfer found in transaction" }, { status: 400 });
            }

            // Decode the transfer details
            const decoded = decodeEventLog({
                abi: ERC20_TRANSFER_ABI,
                data: transferLog.data,
                topics: transferLog.topics
            });

            transferFrom = (decoded.args as any).from;
            transferTo = (decoded.args as any).to;
            transferAmount = (decoded.args as any).value;

        } catch (e) {
            console.error("Alchemy RPC Verification Failed:", e);
            return NextResponse.json({
                error: "Failed to verify transaction: " + (e as Error).message
            }, { status: 400 });
        }

        // Verify Recipient
        const expectedRecipient = session.merchant.payoutAddress?.toLowerCase();
        if (transferTo.toLowerCase() !== expectedRecipient) {
            return NextResponse.json({
                error: `Recipient mismatch. Expected ${expectedRecipient}, got ${transferTo}`
            }, { status: 400 });
        }

        // Verify Amount
        const transferAmountDecimal = parseFloat(formatUnits(transferAmount, MNEE_DECIMALS));
        const expectedAmount = session.amount;

        if (Math.abs(transferAmountDecimal - expectedAmount) > 0.00001) {
            return NextResponse.json({
                error: `Amount mismatch. Expected ${expectedAmount} MNEE, got ${transferAmountDecimal} MNEE`
            }, { status: 400 });
        }

        // 3. Update Checkout Session
        await prisma.checkoutSession.update({
            where: { id: sessionId },
            data: {
                status: "confirmed",
                txHash: txHash,
                transactions: {
                    create: {
                        txHash: txHash,
                        from: transferFrom,
                        to: transferTo,
                        amount: transferAmountDecimal,
                        status: "confirmed"
                    }
                }
            }
        });

        // 4. Fire Webhook
        if (session.callbackUrl) {
            const secret = session.merchant.apiKeys[0]?.secretHash || "default_secret";
            await sendWebhook(session.callbackUrl, {
                event: "checkout.session.completed",
                data: {
                    id: session.id,
                    amount: session.amount,
                    currency: session.currency,
                    status: "confirmed",
                    txHash: txHash,
                    customer_details: { email: "customer@example.com" }
                }
            }, secret);
        }

        console.log(`✅ Payment confirmed! ${transferAmountDecimal} MNEE from ${transferFrom.slice(0, 10)}... to ${transferTo.slice(0, 10)}...`);
        return NextResponse.json({ success: true, redirectUrl: session.redirectUrl });

    } catch (error) {
        console.error("Confirm error:", error);
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
