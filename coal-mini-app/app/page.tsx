'use client';

import { useEffect, useState } from 'react';
import { ProductCard, type ProductCardProps } from '@/components/ProductCard';
import { WalletAuth } from '@/components/WalletAuth';
import { TabBar } from '@/components/TabBar';
import { getProducts } from '@/lib/coal-api';

export default function ShopPage() {
    const [products, setProducts] = useState<ProductCardProps[]>([]);
    const [loading, setLoading] = useState(true);
    const [payer, setPayer] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    useEffect(() => {
        const cached = typeof window !== 'undefined' && window.sessionStorage.getItem('coal:payer');
        if (cached) setPayer(cached);
    }, []);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            setLoading(true);
            try {
                const { products: raw } = await getProducts(10);
                if (cancelled) return;
                const mapped: ProductCardProps[] = raw.map(p => ({
                    linkSlug: p.linkSlug,
                    linkId: p.linkId,
                    name: p.name,
                    description: p.description,
                    price: p.price,
                    image: p.image,
                    merchantName: p.merchantName,
                }));
                setProducts(mapped);
                if (mapped.length === 0) setNotice('No products available right now.');
            } catch {
                if (!cancelled) setNotice('Failed to load products. Try again later.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    function handleAuth(address: string) {
        setPayer(address);
        window.sessionStorage.setItem('coal:payer', address);
    }

    return (
        <main className="safe-top min-h-[100dvh] pb-24 max-w-md mx-auto px-4">
            <header className="py-4 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-black tracking-tight text-[var(--color-brand-navy)]">
                        Coal
                    </h1>
                    <p className="text-[11px] text-gray-500 font-medium leading-tight">
                        Agent commerce on World
                    </p>
                </div>
                {payer && (
                    <span className="text-[10px] font-mono text-gray-500">
                        {payer.slice(0, 6)}…{payer.slice(-4)}
                    </span>
                )}
            </header>

            {!payer && (
                <section className="mt-4 rounded-2xl bg-white border border-black/10 p-4">
                    <h2 className="text-sm font-black text-[var(--color-brand-navy)] mb-1">
                        Connect your World wallet
                    </h2>
                    <p className="text-xs text-gray-500 mb-3 leading-snug">
                        Pay directly from your World App wallet in USDC on World Chain.
                        Verified humans get subsidized gas.
                    </p>
                    <WalletAuth onAuth={handleAuth} />
                </section>
            )}

            <section className="mt-4">
                <h2 className="text-[10px] uppercase tracking-[0.18em] font-black text-gray-400 mb-3 px-1">
                    Shop
                </h2>
                {loading ? (
                    <p className="text-xs text-gray-500 px-1">Loading products…</p>
                ) : notice ? (
                    <p className="text-xs text-gray-500 px-1">{notice}</p>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {products.map((p) => (
                            <ProductCard key={p.linkSlug} {...p} />
                        ))}
                    </div>
                )}
            </section>

            <TabBar />
        </main>
    );
}
