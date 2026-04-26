'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { resolveLink, type ResolvedLink } from '@/lib/coal-api';
import { PayButton } from '@/components/PayButton';
import { WalletAuth } from '@/components/WalletAuth';
import { TabBar } from '@/components/TabBar';

export default function ProductDetailPage() {
    const params = useParams();
    const router = useRouter();
    const slug = decodeURIComponent(params.slug as string);

    const [link, setLink] = useState<ResolvedLink | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [payer, setPayer] = useState<string | null>(null);

    useEffect(() => {
        const cached = typeof window !== 'undefined' && window.sessionStorage.getItem('coal:payer');
        if (cached) setPayer(cached);
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await resolveLink(slug);
                setLink(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load');
            } finally {
                setLoading(false);
            }
        })();
    }, [slug]);

    function handleAuth(address: string) {
        setPayer(address);
        window.sessionStorage.setItem('coal:payer', address);
    }

    function handlePaid(sessionId: string) {
        router.push(`/success/${sessionId}`);
    }

    if (loading) {
        return (
            <main className="safe-top min-h-[100dvh] flex items-center justify-center px-4 pb-24">
                <p className="text-sm text-gray-500">Loading…</p>
                <TabBar />
            </main>
        );
    }

    if (error || !link || !link.product) {
        return (
            <main className="safe-top min-h-[100dvh] flex flex-col items-center justify-center px-4 pb-24">
                <p className="text-sm text-red-500 mb-3">{error || 'Product not found'}</p>
                <Link href="/" className="text-xs underline text-[var(--color-brand-navy)]">
                    Back to shop
                </Link>
                <TabBar />
            </main>
        );
    }

    const payoutAddress = link.merchant.payoutAddress;

    return (
        <main className="safe-top min-h-[100dvh] max-w-md mx-auto px-4 pb-28">
            <header className="py-3">
                <button onClick={() => router.back()} className="text-[12px] font-bold text-[var(--color-brand-navy)]">
                    ← Back
                </button>
            </header>

            <div className="rounded-3xl overflow-hidden bg-white border border-black/10">
                <div className="relative aspect-square w-full bg-black/5">
                    {link.product.image ? (
                        <Image
                            src={link.product.image}
                            alt={link.product.name}
                            fill
                            sizes="100vw"
                            className="object-cover"
                            unoptimized
                        />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-6xl">🛍️</div>
                    )}
                </div>
                <div className="p-4">
                    <h1 className="text-base font-black text-[var(--color-brand-navy)] leading-tight">
                        {link.product.name}
                    </h1>
                    {link.merchant.name && (
                        <p className="text-[11px] text-gray-500 mt-0.5">by {link.merchant.name}</p>
                    )}
                    {link.product.description && (
                        <p className="text-[12px] text-gray-700 mt-2 leading-snug">
                            {link.product.description}
                        </p>
                    )}
                    <div className="mt-3 inline-flex items-center gap-2">
                        <span className="text-lg font-black text-[var(--color-brand-orange)]">
                            ${parseFloat(link.product.price).toFixed(2)}
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            USDC · World Chain
                        </span>
                    </div>
                </div>
            </div>

            <section className="mt-4">
                {!payer ? (
                    <div className="rounded-2xl bg-white border border-black/10 p-4">
                        <p className="text-[12px] text-gray-700 mb-3">
                            Connect your World wallet to pay.
                        </p>
                        <WalletAuth onAuth={handleAuth} />
                    </div>
                ) : !payoutAddress ? (
                    <p className="text-xs text-red-500 p-4 text-center">
                        Merchant has no payout address configured. Cannot accept payments.
                    </p>
                ) : (
                    <PayButton
                        product={{
                            productName: link.product.name,
                            priceUsdc: link.product.price,
                            payoutAddress,
                            linkId: link.id,
                        }}
                        payerAddress={payer}
                        onPaid={handlePaid}
                    />
                )}
            </section>

            <div className="mt-6 text-center">
                <p className="text-[10px] text-gray-400 font-medium">
                    Receipts anchor on 0G Chain + World Chain.
                </p>
            </div>

            <TabBar />
        </main>
    );
}
