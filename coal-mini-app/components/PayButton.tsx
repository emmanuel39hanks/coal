'use client';

import { useState } from 'react';
import { MiniKit, Tokens, tokenToDecimals } from '@worldcoin/minikit-js';
import { confirmSession, createWorldChainSession } from '@/lib/coal-api';

interface PayButtonProps {
    product: {
        productName: string;
        priceUsdc: string;     // decimal string, e.g. "0.01"
        payoutAddress: `0x${string}`;
        linkId: string;
    };
    payerAddress: string | null;
    onPaid?: (sessionId: string, txHash: string) => void;
}

/**
 * One-tap World Chain USDC payment.
 *
 * Uses MiniKit.commandsAsync.pay — the simplest path. World App routes
 * the payment to the user's World Chain wallet and returns a
 * transaction_id. We then notify the Coal backend via /api/pay/confirm
 * with the txHash so the verify-payments cron picks it up.
 */
export function PayButton({ product, payerAddress, onPaid }: PayButtonProps) {
    const [status, setStatus] = useState<
        'idle' | 'creating' | 'awaiting-wallet' | 'confirming' | 'done' | 'error'
    >('idle');
    const [error, setError] = useState<string | null>(null);

    async function handlePay() {
        setError(null);

        if (!payerAddress) {
            setError('Please connect your World wallet first.');
            return;
        }
        if (!MiniKit.isInstalled()) {
            setError('Payment requires World App. Open the Mini App from inside World App.');
            return;
        }

        try {
            setStatus('creating');
            const { data: session } = await createWorldChainSession(product.linkId);
            const reference = `coal-${session.sessionId}`;

            setStatus('awaiting-wallet');
            const { finalPayload } = await MiniKit.commandsAsync.pay({
                reference,
                to: product.payoutAddress,
                tokens: [
                    {
                        symbol: Tokens.USDC,
                        token_amount: tokenToDecimals(
                            parseFloat(product.priceUsdc),
                            Tokens.USDC,
                        ).toString(),
                    },
                ],
                description: `Buy ${product.productName} on Coal`,
            });

            if (finalPayload.status === 'error') {
                setStatus('error');
                setError(`Payment cancelled or failed: ${finalPayload.error_code ?? 'unknown'}`);
                return;
            }

            setStatus('confirming');
            // MiniKit returns `transaction_id` — a World App-internal id.
            // The backend /api/pay/confirm resolves it to the real on-chain
            // hash via the Worldcoin API, so we just pass it through.
            const txHash = (finalPayload as { transaction_id?: string }).transaction_id || '';

            await confirmSession(session.sessionId, txHash, payerAddress);

            setStatus('done');
            onPaid?.(session.sessionId, txHash);
        } catch (err) {
            setStatus('error');
            setError(err instanceof Error ? err.message : 'Unexpected error');
        }
    }

    const label = {
        idle: `Pay ${product.priceUsdc} USDC`,
        creating: 'Creating session…',
        'awaiting-wallet': 'Confirm in World App…',
        confirming: 'Confirming payment…',
        done: '✓ Paid',
        error: 'Retry payment',
    }[status];

    return (
        <div className="flex flex-col gap-2">
            <button
                onClick={handlePay}
                disabled={status !== 'idle' && status !== 'error'}
                className="h-12 w-full rounded-full bg-[var(--color-brand-orange)] text-white font-bold text-sm disabled:opacity-50"
            >
                {label}
            </button>
            {error && <p className="text-xs text-red-500 text-center">{error}</p>}
        </div>
    );
}
