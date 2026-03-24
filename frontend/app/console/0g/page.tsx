'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import {
    ArrowRight,
    ShieldTick,
    Box,
    Cpu,
    Flash,
    ReceiptItem,
    Profile2User,
    Lock,
    TickCircle,
    CloseCircle,
} from 'iconsax-reactjs';
import { Skeleton } from '@/components/Skeleton';
import { useApi } from '@/lib/api';

type HealthCheck =
    | { ok: true; details: Record<string, any> }
    | { ok: false; error: string };

type ZeroGConsoleData = {
    status: 'ok' | 'degraded';
    timestamp: string;
    merchant: {
        id: string;
        profile: {
            name: string | null;
            productCount: number;
            paywallCount: number;
            capabilities: {
                paywalls: boolean;
                receiptVerification: boolean;
                aiCommerce: boolean;
                merchantMemory: boolean;
            };
            storageUri: string | null;
            published: boolean;
            publishedAt: string | null;
            updatedAt: string;
        } | null;
        memory: {
            published: boolean;
            publishedAt: string | null;
            capturedAt: string;
            productCount: number;
            paywallCount: number;
        } | null;
    };
    checks: {
        storage: HealthCheck;
        chain: HealthCheck;
        compute: HealthCheck;
    };
};

function timeAgo(value?: string | null) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const ms = Date.now() - d.getTime();
    const mins = Math.round(ms / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
}

export default function ZeroGConsolePage() {
    const { fetcher } = useApi();
    const { data, isLoading, error } = useSWR<ZeroGConsoleData>('/api/console/0g', fetcher);

    const profile = data?.merchant.profile;
    const memory = data?.merchant.memory;
    const storageOk = data?.checks.storage.ok;
    const chainOk = data?.checks.chain.ok;
    const computeOk = data?.checks.compute.ok;
    const allHealthy = storageOk && chainOk && computeOk;

    if (error) {
        return (
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-[var(--color-brand-navy)]">0G</h1>
                    <p className="font-medium text-[var(--color-text-secondary)]">Could not load 0G status. Try refreshing.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-3xl font-black text-[var(--color-brand-navy)] tracking-tight">0G</h1>
                <p className="text-[var(--color-text-secondary)] font-medium">
                    Permanent receipts, AI paywalls, and portable identity — powered by 0G.
                </p>
            </motion.div>

            {/* Status banner */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 }}
                className="rounded-[28px] border-2 border-black/5 bg-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
                <div className="flex items-center gap-3">
                    {isLoading ? (
                        <Skeleton className="h-10 w-10 rounded-2xl" />
                    ) : (
                        <div className={`rounded-2xl p-2.5 ${allHealthy ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-[var(--color-brand-orange)]'}`}>
                            {allHealthy ? <TickCircle size={20} variant="Bold" /> : <CloseCircle size={20} variant="Bold" />}
                        </div>
                    )}
                    <div>
                        <p className="text-base font-black text-[var(--color-brand-navy)] tracking-tight">
                            {isLoading ? <Skeleton className="h-5 w-40 rounded-lg" /> : allHealthy ? 'All systems operational' : 'Some services need attention'}
                        </p>
                        <p className="text-xs font-medium text-[var(--color-text-secondary)] mt-0.5">
                            {isLoading ? <Skeleton className="h-3 w-56 rounded-lg mt-1" /> : `Storage · Chain · Compute — checked ${timeAgo(data?.timestamp) || 'now'}`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {[
                        { label: 'Storage', ok: storageOk },
                        { label: 'Chain', ok: chainOk },
                        { label: 'Compute', ok: computeOk },
                    ].map(({ label, ok }) => (
                        <span
                            key={label}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] ${
                                isLoading
                                    ? 'bg-black/5 text-[var(--color-text-secondary)]'
                                    : ok
                                    ? 'bg-green-50 text-green-700'
                                    : 'bg-orange-50 text-[var(--color-brand-orange)]'
                            }`}
                        >
                            <span className={`h-1.5 w-1.5 rounded-full ${isLoading ? 'bg-current opacity-30' : ok ? 'bg-green-500' : 'bg-[var(--color-brand-orange)]'}`} />
                            {label}
                        </span>
                    ))}
                </div>
            </motion.div>

            {/* What 0G does for you — 4 cards */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            >
                {[
                    {
                        icon: ReceiptItem,
                        title: 'Verifiable receipts',
                        desc: 'Every confirmed payment is stored permanently on 0G. Customers and auditors can verify any receipt without contacting you.',
                        enabled: profile?.capabilities.receiptVerification,
                    },
                    {
                        icon: Flash,
                        title: 'AI-ready paywalls',
                        desc: 'Your paywalls are published as machine-readable manifests. AI agents can discover, pay, and verify access autonomously.',
                        enabled: profile?.capabilities.paywalls,
                    },
                    {
                        icon: Profile2User,
                        title: 'Portable identity',
                        desc: 'Your merchant profile and catalog live on decentralized storage. Your reputation and history stay yours, not locked to a platform.',
                        enabled: profile?.capabilities.merchantMemory,
                    },
                    {
                        icon: Cpu,
                        title: 'AI commerce',
                        desc: 'AI models can query your products, check buyer access, and answer questions using your merchant context.',
                        enabled: profile?.capabilities.aiCommerce,
                    },
                ].map(({ icon: Icon, title, desc, enabled }, i) => (
                    <div key={title} className="rounded-[28px] border-2 border-black/5 bg-white p-5 flex flex-col">
                        <div className="flex items-start justify-between gap-3">
                            <div className="rounded-2xl bg-[var(--color-bg-base)] p-2.5 text-[var(--color-brand-navy)]">
                                <Icon size={20} variant="Bold" />
                            </div>
                            <span
                                className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                                    isLoading ? 'bg-black/5 text-[var(--color-text-secondary)]' : enabled ? 'bg-green-50 text-green-700' : 'bg-black/5 text-[var(--color-text-secondary)]'
                                }`}
                            >
                                {isLoading ? '...' : enabled ? 'Active' : 'Not yet'}
                            </span>
                        </div>
                        <h3 className="mt-4 text-sm font-black text-[var(--color-brand-navy)] tracking-tight">{title}</h3>
                        <p className="mt-1.5 text-xs leading-5 font-medium text-[var(--color-text-secondary)] flex-1">{desc}</p>
                    </div>
                ))}
            </motion.div>

            {/* Your published data */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="grid gap-4 lg:grid-cols-2"
            >
                {/* Merchant Profile */}
                <div className="rounded-[28px] border-2 border-black/5 bg-white p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="rounded-2xl bg-[var(--color-brand-navy)] p-2.5 text-white">
                            <Box size={18} variant="Bold" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-base font-black text-[var(--color-brand-navy)] tracking-tight">Your profile</h3>
                            <p className="text-xs font-medium text-[var(--color-text-secondary)]">Published to 0G Storage</p>
                        </div>
                        <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                                isLoading ? 'bg-black/5 text-[var(--color-text-secondary)]' : profile?.published ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-[var(--color-brand-orange)]'
                            }`}
                        >
                            {isLoading ? '...' : profile?.published ? 'Live' : 'Pending'}
                        </span>
                    </div>
                    <div className="space-y-3">
                        {isLoading ? (
                            <>
                                <Skeleton className="h-4 w-full rounded-lg" />
                                <Skeleton className="h-4 w-3/4 rounded-lg" />
                            </>
                        ) : (
                            <>
                                <Row label="Products" value={profile?.productCount ?? 0} />
                                <Row label="Paywalls" value={profile?.paywallCount ?? 0} />
                                <Row label="Last updated" value={timeAgo(profile?.updatedAt) || 'Never'} />
                                <Row label="Last published" value={timeAgo(profile?.publishedAt) || 'Not yet'} />
                            </>
                        )}
                    </div>
                    {!isLoading && !profile?.published && (
                        <p className="mt-4 text-xs font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-base)] rounded-2xl p-3">
                            Your profile will auto-publish when you add your first product or paywall.
                        </p>
                    )}
                </div>

                {/* Merchant Memory */}
                <div className="rounded-[28px] border-2 border-black/5 bg-white p-6">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="rounded-2xl bg-[var(--color-brand-orange)] p-2.5 text-white">
                            <Lock size={18} variant="Bold" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-base font-black text-[var(--color-brand-navy)] tracking-tight">Your memory</h3>
                            <p className="text-xs font-medium text-[var(--color-text-secondary)]">Encrypted snapshot on 0G</p>
                        </div>
                        <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                                isLoading ? 'bg-black/5 text-[var(--color-text-secondary)]' : memory?.published ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-[var(--color-brand-orange)]'
                            }`}
                        >
                            {isLoading ? '...' : memory?.published ? 'Live' : 'Pending'}
                        </span>
                    </div>
                    <div className="space-y-3">
                        {isLoading ? (
                            <>
                                <Skeleton className="h-4 w-full rounded-lg" />
                                <Skeleton className="h-4 w-3/4 rounded-lg" />
                            </>
                        ) : (
                            <>
                                <Row label="Products synced" value={memory?.productCount ?? 0} />
                                <Row label="Paywalls synced" value={memory?.paywallCount ?? 0} />
                                <Row label="Last snapshot" value={timeAgo(memory?.capturedAt) || 'Never'} />
                                <Row label="Last published" value={timeAgo(memory?.publishedAt) || 'Not yet'} />
                            </>
                        )}
                    </div>
                    {!isLoading && !memory?.published && (
                        <p className="mt-4 text-xs font-medium text-[var(--color-text-secondary)] bg-[var(--color-bg-base)] rounded-2xl p-3">
                            Memory snapshots are encrypted and published automatically as you add products and paywalls.
                        </p>
                    )}
                </div>
            </motion.div>

            {/* Learn more CTA */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 }}
                className="rounded-[28px] bg-[var(--color-brand-navy)] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
                <div>
                    <p className="text-base font-black text-white tracking-tight">
                        Want to learn more about Coal x 0G?
                    </p>
                    <p className="mt-1 text-sm font-medium text-white/50">
                        See how verifiable receipts, AI paywalls, and portable identity work under the hood.
                    </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <Link
                        href="/0g"
                        className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-[var(--color-brand-navy)] transition-all hover:shadow-lg"
                    >
                        Learn more
                        <ArrowRight size={15} variant="Linear" />
                    </Link>
                    <Link
                        href="/docs"
                        className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-sm font-bold text-white/80 transition-all hover:border-white/30 hover:text-white"
                    >
                        Docs
                        <ArrowRight size={15} variant="Linear" />
                    </Link>
                </div>
            </motion.div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="flex items-center justify-between gap-4 text-sm">
            <span className="font-medium text-[var(--color-text-secondary)]">{label}</span>
            <span className="font-bold text-[var(--color-brand-navy)]">{String(value)}</span>
        </div>
    );
}
