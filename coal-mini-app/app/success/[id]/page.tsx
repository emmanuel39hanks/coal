'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getReceipt, getSessionStatus } from '@/lib/coal-api';
import { TabBar } from '@/components/TabBar';

type ReceiptData = Awaited<ReturnType<typeof getReceipt>>;

export default function SuccessPage() {
    const { id } = useParams<{ id: string }>();
    const [status, setStatus] = useState<string>('pending');
    const [receipt, setReceipt] = useState<ReceiptData | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Poll status until confirmed, then fetch receipt.
    useEffect(() => {
        if (!id) return;
        let cancelled = false;
        let attempts = 0;

        async function tick() {
            try {
                const s = await getSessionStatus(id);
                if (cancelled) return;
                setStatus(s.status);
                if (s.status === 'confirmed') {
                    const r = await getReceipt(id);
                    if (!cancelled) setReceipt(r);
                    return;
                }
                if (s.status === 'failed' || s.status === 'expired') {
                    if (!cancelled) setError(`Payment ${s.status}`);
                    return;
                }
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : 'Status check failed');
                return;
            }

            attempts += 1;
            if (attempts < 60 && !cancelled) {
                setTimeout(tick, 3_000);
            }
        }

        tick();
        return () => {
            cancelled = true;
        };
    }, [id]);

    return (
        <main className="safe-top min-h-[100dvh] max-w-md mx-auto px-4 pb-28 flex flex-col">
            <header className="py-3">
                <Link href="/" className="text-[12px] font-bold text-[var(--color-brand-navy)]">
                    ← Back to shop
                </Link>
            </header>

            <div className="mt-6 rounded-3xl bg-white border border-black/10 p-6 text-center">
                {status === 'confirmed' && receipt?.verified ? (
                    <>
                        <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
                            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                                <path
                                    d="M22 8L12 18 6 12"
                                    stroke="#16A34A"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </div>
                        <h1 className="text-lg font-black text-[var(--color-brand-navy)]">
                            Payment confirmed
                        </h1>
                        {receipt.payment && (
                            <p className="text-sm text-gray-500 mt-1">
                                ${parseFloat(receipt.payment.amount).toFixed(2)} {receipt.payment.currency} ·{' '}
                                {receipt.payment.chainName || 'World Chain'}
                            </p>
                        )}
                        {receipt.payment?.explorerUrl && (
                            <a
                                href={receipt.payment.explorerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-4 inline-block text-[11px] font-bold text-[var(--color-brand-orange)] underline"
                            >
                                View on Worldscan →
                            </a>
                        )}
                        <div className="mt-4 text-[10px] text-gray-400 font-medium">
                            Receipt anchored on 0G + World Chain.
                        </div>
                    </>
                ) : error ? (
                    <>
                        <div className="text-3xl mb-2">⚠️</div>
                        <h1 className="text-lg font-black text-[var(--color-brand-navy)]">{error}</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Session id: <span className="font-mono text-[10px]">{id}</span>
                        </p>
                    </>
                ) : (
                    <>
                        <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center">
                            <svg
                                className="animate-spin"
                                width="28"
                                height="28"
                                viewBox="0 0 24 24"
                                fill="none"
                            >
                                <circle cx="12" cy="12" r="10" stroke="#D97706" strokeOpacity="0.2" strokeWidth="3" />
                                <path d="M4 12a8 8 0 018-8" stroke="#D97706" strokeWidth="3" strokeLinecap="round" />
                            </svg>
                        </div>
                        <h1 className="text-lg font-black text-[var(--color-brand-navy)]">
                            Waiting for confirmation
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Status: <span className="font-bold">{status}</span>
                        </p>
                        <p className="text-[11px] text-gray-400 mt-3 leading-snug">
                            World Chain L2 finality usually completes in under a minute. The verify
                            cron runs every few seconds locally (every 5 min in prod).
                        </p>
                    </>
                )}
            </div>

            <TabBar />
        </main>
    );
}
