'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import useSWR from 'swr';
import {
    ArrowRight,
    Box,
    Cpu,
    DocumentText,
    ExportSquare,
    Flash,
    Lock,
    ReceiptItem,
    ShieldTick,
    Hierarchy,
} from 'iconsax-reactjs';
import { Skeleton, StatCardSkeleton } from '@/components/Skeleton';
import { useApi } from '@/lib/api';

/* ─── Types ───────────────────────────────────────────────────────────── */

type ActivityItem = {
    id: string;
    type: 'artifact' | 'anchor' | 'compute';
    kind: string;
    status: string;
    createdAt: string;
    explorerUrl?: string | null;
    storageUri?: string | null;
    anchorTxHash?: string | null;
    storageTxHash?: string | null;
    model?: string | null;
    errorMessage?: string | null;
};

type ZeroGData = {
    status: 'ok' | 'degraded';
    timestamp: string;
    explorers: { storageScan: string; chainScan: string };
    stats: {
        receiptsStored: number;
        receiptsAnchored: number;
        profilePublished: boolean;
        memoryPublished: boolean;
        paywallManifests: number;
        aiQueries: number;
        confirmedPayments: number;
    };
    merchant: {
        id: string;
        profile: {
            name: string | null;
            productCount: number;
            paywallCount: number;
            published: boolean;
            publishedAt: string | null;
            explorerUrl: string | null;
        } | null;
        memory: {
            published: boolean;
            publishedAt: string | null;
            explorerUrl: string | null;
        } | null;
    };
    activity: ActivityItem[];
    checks: {
        storage: { ok: boolean };
        chain: { ok: boolean };
        compute: { ok: boolean };
    };
};

/* ─── Helpers ─────────────────────────────────────────────────────────── */

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

function truncate(s: string | null | undefined, len = 16) {
    if (!s) return '—';
    if (s.length <= len) return s;
    return s.slice(0, 8) + '…' + s.slice(-6);
}

const KIND_LABELS: Record<string, string> = {
    receipt_payload: 'Receipt proof',
    merchant_profile: 'Merchant profile',
    merchant_memory_snapshot: 'Memory snapshot',
    paywall_manifest: 'Paywall manifest',
    commerce_recommend: 'AI recommendation',
    memory_query: 'Memory query',
    policy_eval: 'Policy check',
    support_answer: 'Support query',
};

const KIND_ICONS: Record<string, typeof ReceiptItem> = {
    receipt_payload: ReceiptItem,
    merchant_profile: Box,
    merchant_memory_snapshot: Lock,
    paywall_manifest: DocumentText,
};

function kindLabel(kind: string) {
    return KIND_LABELS[kind] || kind.replace(/_/g, ' ');
}

/* ─── Page ────────────────────────────────────────────────────────────── */

export default function ZeroGConsolePage() {
    const { fetcher, request } = useApi();
    const { data, isLoading, error, mutate } = useSWR<ZeroGData>('/api/console/0g', fetcher);
    const [publishing, setPublishing] = useState(false);
    const [publishDone, setPublishDone] = useState(false);

    const handlePublish = async () => {
        if (publishing) return;
        setPublishing(true);
        setPublishDone(false);
        try {
            await request('/api/console/0g', { method: 'POST' });
            await mutate();
            setPublishDone(true);
            setTimeout(() => setPublishDone(false), 3000);
        } catch {
            // silently fail — user can retry
        } finally {
            setPublishing(false);
        }
    };

    if (error) {
        return (
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-[var(--color-brand-navy)]">0G</h1>
                    <p className="font-medium text-[var(--color-text-secondary)]">Failed to load. Try refreshing.</p>
                </div>
            </div>
        );
    }

    const stats = data?.stats;
    const activity = data?.activity ?? [];
    const hasActivity = activity.length > 0;

    return (
        <div className="space-y-8">
            {/* ─── Header ─────────────────────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between"
            >
                <div>
                    <h1 className="text-3xl font-black text-[var(--color-brand-navy)] tracking-tight">0G</h1>
                    <p className="text-[var(--color-text-secondary)] font-medium">
                        Your payment proofs, published data, and AI activity on 0G.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Status badges */}
                    <div className="flex items-center gap-2">
                        {['Storage', 'Chain', 'Compute'].map((label) => {
                            const key = label.toLowerCase() as 'storage' | 'chain' | 'compute';
                            const ok = data?.checks[key]?.ok;
                            return (
                                <span
                                    key={label}
                                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${
                                        isLoading
                                            ? 'bg-black/5 text-[var(--color-text-secondary)]'
                                            : ok
                                            ? 'bg-green-50 text-green-700'
                                            : 'bg-red-50 text-red-600'
                                    }`}
                                >
                                    <span
                                        className={`h-1.5 w-1.5 rounded-full ${
                                            isLoading ? 'bg-current opacity-30' : ok ? 'bg-green-500' : 'bg-red-500'
                                        }`}
                                    />
                                    {label}
                                </span>
                            );
                        })}
                    </div>

                    {/* Publish button */}
                    <button
                        onClick={handlePublish}
                        disabled={publishing || isLoading}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold border-2 transition-all disabled:opacity-50 ${
                            publishDone
                                ? 'bg-white text-green-600 border-green-200 shadow-none'
                                : 'bg-black text-white border-black shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none'
                        }`}
                    >
                        <Flash size={14} variant="Bold" className={publishing ? 'animate-pulse' : ''} />
                        {publishing ? 'Publishing…' : publishDone ? 'Published!' : 'Publish to 0G'}
                    </button>
                </div>
            </motion.div>

            {/* ─── Stat cards ─────────────────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="grid grid-cols-1 md:grid-cols-4 gap-4"
            >
                {isLoading ? (
                    <>
                        <StatCardSkeleton />
                        <StatCardSkeleton />
                        <StatCardSkeleton />
                        <StatCardSkeleton />
                    </>
                ) : (
                    <>
                        <StatCard
                            icon={ReceiptItem}
                            iconBg="bg-green-50"
                            iconColor="text-green-600"
                            label="Receipt proofs"
                            value={stats?.receiptsStored ?? 0}
                        />
                        <StatCard
                            icon={ShieldTick}
                            iconBg="bg-blue-50"
                            iconColor="text-blue-600"
                            label="Chain anchors"
                            value={stats?.receiptsAnchored ?? 0}
                        />
                        <StatCard
                            icon={Hierarchy}
                            iconBg="bg-purple-50"
                            iconColor="text-purple-600"
                            label="Published data"
                            value={(stats?.profilePublished ? 1 : 0) + (stats?.memoryPublished ? 1 : 0) + (stats?.paywallManifests ?? 0)}
                        />
                        <StatCard
                            icon={Cpu}
                            iconBg="bg-orange-50"
                            iconColor="text-[var(--color-brand-orange)]"
                            label="AI queries"
                            value={stats?.aiQueries ?? 0}
                        />
                    </>
                )}
            </motion.div>

            {/* ─── Published data ─────────────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="grid gap-4 lg:grid-cols-2"
            >
                <PublishedCard
                    icon={Box}
                    title="Merchant profile"
                    description="Your name, products, and catalog published to 0G Storage. Discoverable by AI agents and apps."
                    published={data?.merchant.profile?.published ?? false}
                    publishedAt={data?.merchant.profile?.publishedAt}
                    explorerUrl={data?.merchant.profile?.explorerUrl}
                    isLoading={isLoading}
                    detail={
                        data?.merchant.profile
                            ? [
                                `${data.merchant.profile.productCount} product${data.merchant.profile.productCount === 1 ? '' : 's'}`,
                                data.merchant.profile.paywallCount > 0 && `${data.merchant.profile.paywallCount} paywall${data.merchant.profile.paywallCount === 1 ? '' : 's'}`,
                              ].filter(Boolean).join(', ')
                            : null
                    }
                />
                <PublishedCard
                    icon={Lock}
                    title="Encrypted memory"
                    description="Your full catalog and settings, encrypted and stored on 0G. Used by AI commerce to answer queries about your business."
                    published={data?.merchant.memory?.published ?? false}
                    publishedAt={data?.merchant.memory?.publishedAt}
                    explorerUrl={data?.merchant.memory?.explorerUrl}
                    isLoading={isLoading}
                />
            </motion.div>

            {/* ─── Activity table ─────────────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-white rounded-[40px] border-2 border-black/5 p-8"
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-[var(--color-brand-navy)]">Activity</h2>
                    {data?.explorers && (
                        <div className="flex gap-2">
                            <a
                                href={data.explorers.storageScan}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-brand-orange)] transition-colors"
                            >
                                StorageScan <ExportSquare size={12} variant="Linear" />
                            </a>
                            <a
                                href={data.explorers.chainScan}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-brand-orange)] transition-colors"
                            >
                                ChainScan <ExportSquare size={12} variant="Linear" />
                            </a>
                        </div>
                    )}
                </div>

                {isLoading ? (
                    <div className="space-y-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="flex items-center gap-4">
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-48 rounded-full" />
                                    <Skeleton className="h-3 w-32 rounded-full" />
                                </div>
                                <Skeleton className="h-6 w-20 rounded-lg" />
                            </div>
                        ))}
                    </div>
                ) : !hasActivity ? (
                    <div className="py-16 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-bg-base)]">
                            <Flash size={28} variant="Bold" className="text-[var(--color-text-secondary)]" />
                        </div>
                        <p className="text-base font-bold text-[var(--color-brand-navy)] mb-1">No 0G activity yet</p>
                        <p className="text-sm text-[var(--color-text-secondary)] max-w-sm mx-auto mb-6">
                            When customers pay you, receipt proofs are automatically stored on 0G. Add products to publish your merchant profile.
                        </p>
                        <div className="flex items-center justify-center gap-3">
                            <Link
                                href="/console/products"
                                className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white shadow-[4px_4px_0px_0px_#FF5C16] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#FF5C16]"
                            >
                                Add a product <ArrowRight size={15} variant="Linear" />
                            </Link>
                            <Link
                                href="/docs"
                                className="inline-flex items-center gap-2 rounded-full border-2 border-black/5 bg-white px-5 py-2.5 text-sm font-bold text-[var(--color-brand-navy)] hover:border-[var(--color-brand-orange)]/25 hover:text-[var(--color-brand-orange)] transition-colors"
                            >
                                Docs <ArrowRight size={15} variant="Linear" />
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-black/5">
                                    <th className="pb-4 text-left text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Event</th>
                                    <th className="pb-4 text-left text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Type</th>
                                    <th className="pb-4 text-left text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Status</th>
                                    <th className="pb-4 text-left text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">When</th>
                                    <th className="pb-4 text-right text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Explorer</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activity.slice(0, 25).map((item) => {
                                    const IconComp = item.type === 'anchor' ? ShieldTick : item.type === 'compute' ? Cpu : (KIND_ICONS[item.kind] ?? Flash);
                                    const iconBg =
                                        item.type === 'anchor' ? 'bg-blue-50 text-blue-600' :
                                        item.type === 'compute' ? 'bg-orange-50 text-[var(--color-brand-orange)]' :
                                        item.kind === 'receipt_payload' ? 'bg-green-50 text-green-600' :
                                        'bg-purple-50 text-purple-600';
                                    const statusColor =
                                        item.status === 'confirmed' || item.status === 'completed'
                                            ? 'bg-green-50 text-green-700 border-green-100'
                                            : item.status === 'failed'
                                            ? 'bg-red-50 text-red-600 border-red-100'
                                            : 'bg-yellow-50 text-yellow-700 border-yellow-100';

                                    return (
                                        <tr key={item.id} className="group hover:bg-[var(--color-bg-base)] transition-colors">
                                            <td className="py-4 pl-1 rounded-l-xl">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${iconBg}`}>
                                                        <IconComp size={16} variant="Bold" />
                                                    </div>
                                                    <span className="text-sm font-bold text-[var(--color-brand-navy)]">
                                                        {kindLabel(item.kind)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-4">
                                                <span className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                                                    {item.type === 'artifact' ? 'Storage' : item.type === 'anchor' ? 'Chain' : 'Compute'}
                                                </span>
                                            </td>
                                            <td className="py-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${statusColor}`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                            <td className="py-4 text-sm font-medium text-[var(--color-text-secondary)]">
                                                {timeAgo(item.createdAt) || '—'}
                                            </td>
                                            <td className="py-4 pr-1 text-right rounded-r-xl">
                                                {item.explorerUrl ? (
                                                    <a
                                                        href={item.explorerUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-brand-orange)] transition-colors"
                                                    >
                                                        View <ExportSquare size={12} variant="Linear" />
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-[var(--color-text-secondary)]">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </motion.div>
        </div>
    );
}

/* ─── Components ──────────────────────────────────────────────────────── */

function StatCard({
    icon: Icon,
    iconBg,
    iconColor,
    label,
    value,
}: {
    icon: typeof ReceiptItem;
    iconBg: string;
    iconColor: string;
    label: string;
    value: number;
}) {
    return (
        <div className="bg-white p-6 rounded-[32px] border-2 border-black/5 h-40 group hover:border-[var(--color-brand-orange)]/20 transition-all">
            <div className={`p-3 rounded-2xl inline-flex ${iconBg} group-hover:scale-105 transition-transform`}>
                <Icon size={20} variant="Bold" className={iconColor} />
            </div>
            <p className="mt-3 text-[var(--color-text-secondary)] font-bold text-sm">{label}</p>
            <p className="text-3xl font-black text-[var(--color-brand-navy)]">{value}</p>
        </div>
    );
}

function PublishedCard({
    icon: Icon,
    title,
    description,
    published,
    publishedAt,
    explorerUrl,
    isLoading,
    detail,
}: {
    icon: typeof Box;
    title: string;
    description: string;
    published: boolean;
    publishedAt?: string | null;
    explorerUrl?: string | null;
    isLoading: boolean;
    detail?: string | null;
}) {
    return (
        <div className="bg-white rounded-[32px] border-2 border-black/5 p-6">
            <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-[var(--color-bg-base)] p-3">
                        <Icon size={20} variant="Bold" className="text-[var(--color-brand-navy)]" />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-[var(--color-brand-navy)] tracking-tight">{title}</h3>
                        {detail && (
                            <p className="text-xs font-medium text-[var(--color-text-secondary)]">{detail}</p>
                        )}
                    </div>
                </div>
                <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                        isLoading
                            ? 'bg-black/5 text-[var(--color-text-secondary)]'
                            : published
                            ? 'bg-green-50 text-green-700'
                            : 'bg-black/5 text-[var(--color-text-secondary)]'
                    }`}
                >
                    {isLoading ? '...' : published ? 'Published' : 'Not published'}
                </span>
            </div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)] leading-6 mb-4">{description}</p>
            <div className="flex items-center gap-3">
                {published && publishedAt && (
                    <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                        Published {timeAgo(publishedAt)}
                    </span>
                )}
                {explorerUrl && (
                    <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-brand-orange)] hover:underline"
                    >
                        View on StorageScan <ExportSquare size={12} variant="Linear" />
                    </a>
                )}
            </div>
        </div>
    );
}
