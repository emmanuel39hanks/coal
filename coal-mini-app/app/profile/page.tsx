'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { WalletAuth } from '@/components/WalletAuth';
import { WorldIdVerify } from '@/components/WorldIdVerify';
import { TabBar } from '@/components/TabBar';
import { getOrderHistory } from '@/lib/coal-api';

type Order = Awaited<ReturnType<typeof getOrderHistory>>['orders'][number];

interface VerificationState {
    nullifierHash: string;
    level: string;
    verifiedAt: string;
}

export default function ProfilePage() {
    const [payer, setPayer] = useState<string | null>(null);
    const [verified, setVerified] = useState<VerificationState | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(false);

    useEffect(() => {
        const cachedPayer = window.sessionStorage.getItem('coal:payer');
        if (cachedPayer) setPayer(cachedPayer);
        const cachedVerified = window.sessionStorage.getItem('coal:verified');
        if (cachedVerified) {
            try {
                setVerified(JSON.parse(cachedVerified));
            } catch {
                // ignore corrupt cache
            }
        }
    }, []);

    useEffect(() => {
        if (!payer) { setOrders([]); return; }
        setOrdersLoading(true);
        getOrderHistory(payer)
            .then(res => setOrders(res.orders))
            .catch(() => setOrders([]))
            .finally(() => setOrdersLoading(false));
    }, [payer]);

    function handleAuth(address: string) {
        setPayer(address);
        window.sessionStorage.setItem('coal:payer', address);
    }

    function handleVerified(nullifierHash: string, level: string) {
        const state: VerificationState = {
            nullifierHash,
            level,
            verifiedAt: new Date().toISOString(),
        };
        setVerified(state);
        window.sessionStorage.setItem('coal:verified', JSON.stringify(state));
    }

    return (
        <main className="safe-top min-h-[100dvh] max-w-md mx-auto px-4 pb-28">
            <header className="py-4">
                <h1 className="text-xl font-black text-[var(--color-brand-navy)]">Profile</h1>
            </header>

            <section className="rounded-2xl bg-white border border-black/10 p-4">
                <h2 className="text-[10px] uppercase tracking-[0.18em] font-black text-gray-400 mb-2">
                    Wallet
                </h2>
                {payer ? (
                    <div className="flex items-center justify-between">
                        <span className="text-[12px] font-mono text-[var(--color-brand-navy)]">
                            {payer.slice(0, 10)}…{payer.slice(-6)}
                        </span>
                        <button
                            onClick={() => {
                                setPayer(null);
                                setVerified(null);
                                window.sessionStorage.removeItem('coal:payer');
                                window.sessionStorage.removeItem('coal:verified');
                            }}
                            className="text-[10px] font-bold text-gray-400 underline"
                        >
                            disconnect
                        </button>
                    </div>
                ) : (
                    <WalletAuth onAuth={handleAuth} />
                )}
            </section>

            <section className="mt-4 rounded-2xl bg-white border border-black/10 p-4">
                <h2 className="text-[10px] uppercase tracking-[0.18em] font-black text-gray-400 mb-2">
                    World ID
                </h2>
                {verified ? (
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[10px] font-bold text-green-700">
                                ✓ Verified human
                            </span>
                            <span className="text-[10px] text-gray-500 uppercase font-bold">
                                {verified.level}
                            </span>
                        </div>
                        <p className="text-[10px] font-mono text-gray-400 break-all">
                            {verified.nullifierHash.slice(0, 18)}…{verified.nullifierHash.slice(-10)}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-2">
                            Spending cap: <span className="font-bold text-[var(--color-brand-navy)]">$50</span>
                        </p>
                    </div>
                ) : (
                    <div>
                        <p className="text-[12px] text-gray-700 mb-3 leading-snug">
                            Verified humans get a higher spending cap ($50 vs $5 unverified)
                            and subsidized gas on World Chain.
                        </p>
                        {payer ? (
                            <WorldIdVerify payerAddress={payer} onVerified={handleVerified} />
                        ) : (
                            <p className="text-[11px] text-gray-500">
                                Connect your wallet first.
                            </p>
                        )}
                    </div>
                )}
            </section>

            <section className="mt-4 rounded-2xl bg-white border border-black/10 p-4">
                <h2 className="text-[10px] uppercase tracking-[0.18em] font-black text-gray-400 mb-3">
                    My Orders
                </h2>
                {!payer ? (
                    <p className="text-[11px] text-gray-500">Connect your wallet to see orders.</p>
                ) : ordersLoading ? (
                    <p className="text-[11px] text-gray-400">Loading…</p>
                ) : orders.length === 0 ? (
                    <p className="text-[11px] text-gray-500">No purchases yet.</p>
                ) : (
                    <ul className="flex flex-col gap-3">
                        {orders.map(order => (
                            <li key={order.id} className="flex items-center gap-3">
                                {order.product?.image && (
                                    <img
                                        src={order.product.image}
                                        alt={order.product.name ?? ''}
                                        className="h-10 w-10 rounded-xl object-cover flex-shrink-0"
                                    />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-bold text-[var(--color-brand-navy)] truncate">
                                        {order.product?.name ?? 'Product'}
                                    </p>
                                    <p className="text-[10px] text-gray-500">
                                        ${parseFloat(order.amount).toFixed(2)} {order.currency} ·{' '}
                                        {new Date(order.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                                {order.explorerUrl && (
                                    <a
                                        href={order.explorerUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[10px] font-bold text-[var(--color-brand-orange)] flex-shrink-0"
                                    >
                                        Tx →
                                    </a>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="mt-4 rounded-2xl bg-[var(--color-brand-navy)] text-white p-4">
                <h2 className="text-[10px] uppercase tracking-[0.18em] font-black text-white/50 mb-2">
                    About Coal
                </h2>
                <p className="text-[12px] leading-snug text-white/90">
                    Coal is payment rails for the agent economy. Merchants integrate once.
                    AI agents discover via MCP. Humans verify via World ID. Payments settle on
                    World Chain or Base. Receipts anchor on 0G.
                </p>
                <Link
                    href="https://usecoal.xyz"
                    target="_blank"
                    className="mt-3 inline-block text-[11px] font-bold text-[var(--color-brand-orange)]"
                >
                    usecoal.xyz →
                </Link>
            </section>

            <TabBar />
        </main>
    );
}
