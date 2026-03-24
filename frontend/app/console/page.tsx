'use client';

import { motion } from 'framer-motion';
import { Coin, Receipt1, Box } from 'iconsax-reactjs';
import useSWR from 'swr';
import Link from 'next/link';
import { useState } from 'react';
import Modal from '@/components/Modal';
import { useApi } from '@/lib/api';
import { Skeleton, StatCardSkeleton, ChartSkeleton } from '@/components/Skeleton';
import { useAuth } from '@/lib/auth';
import OnboardingChecklist from '@/components/OnboardingChecklist';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
} from 'recharts';
import { formatAmount, parseAmountInput } from '@/lib/utils';
import { getSettlementToken } from '@/lib/chain';

type ChartEntry = { date: string; revenue: string; count: number };

export default function ConsoleOverview() {
    const { fetcher } = useApi();
    const { user } = useAuth();
    const { data: stats, error, isLoading } = useSWR('/api/console/stats', fetcher);
    const { data: settingsData } = useSWR('/api/console/settings', fetcher);
    const [isSelectionOpen, setIsSelectionOpen] = useState(false);
    const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
    const { data: analytics, isLoading: analyticsLoading } = useSWR(
        `/api/console/analytics?period=${period}`,
        fetcher
    );

    if (error) return <div>Failed to load</div>;

    const merchantId = user?.id ?? 'unknown';
    const hasPayoutAddress = !!(settingsData?.payoutAddress);

    const revenue = parseAmountInput(stats?.revenue) ?? 0;
    const txCount = stats?.totalTransactions || 0;
    const items = stats?.activeItems || 0;
    const recentTx = stats?.recentActivity || [];
    const settlementSymbol = getSettlementToken().symbol;

    return (
        <div className="space-y-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between"
            >
                <div>
                    <h1 className="text-3xl font-black text-[var(--color-brand-navy)] tracking-tight">Overview</h1>
                    <p className="text-[var(--color-text-secondary)] font-medium">Welcome back to your dashboard.</p>
                </div>
                <button
                    onClick={() => setIsSelectionOpen(true)}
                    className="bg-black text-white px-6 py-2.5 rounded-full flex items-center gap-2 text-sm font-bold shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px]"
                >
                    <Box size={18} variant="Bold" className="text-white" />
                    New Item
                </button>
            </motion.div>

            {/* Onboarding Checklist */}
            {merchantId !== 'unknown' && (
                <OnboardingChecklist
                    merchantId={merchantId}
                    hasPayoutAddress={hasPayoutAddress}
                />
            )}

            {/* Selection Modal */}
            <Modal
                isOpen={isSelectionOpen}
                onClose={() => setIsSelectionOpen(false)}
                title="Create New"
            >
                <p className="text-[var(--color-text-secondary)] font-medium mb-8">What would you like to create?</p>

                <div className="grid grid-cols-2 gap-4">
                    <Link href="/console/products?new=true" className="group">
                        <div className="bg-gray-50 border-2 border-black/5 hover:border-[var(--color-brand-orange)] rounded-3xl p-6 flex flex-col items-center justify-center gap-3 transition-all h-40 hover:-translate-y-1 hover:shadow-lg">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-[var(--color-brand-navy)] group-hover:text-[var(--color-brand-orange)] transition-colors">
                                <Box size={24} variant="Bold" />
                            </div>
                            <span className="font-bold text-[var(--color-brand-navy)]">Product</span>
                        </div>
                    </Link>

                    <Link href="/console/payment-links?new=true" className="group">
                        <div className="bg-gray-50 border-2 border-black/5 hover:border-[var(--color-brand-orange)] rounded-3xl p-6 flex flex-col items-center justify-center gap-3 transition-all h-40 hover:-translate-y-1 hover:shadow-lg">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-[var(--color-brand-navy)] group-hover:text-[var(--color-brand-orange)] transition-colors">
                                <Receipt1 size={24} variant="Bold" />
                            </div>
                            <span className="font-bold text-[var(--color-brand-navy)]">Payment Link</span>
                        </div>
                    </Link>
                </div>
            </Modal>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-[32px] border-2 border-black/5 flex flex-col justify-between h-40 group hover:border-[var(--color-brand-orange)]/20 transition-colors">
                    <div className="flex items-start justify-between">
                        <div className="p-3 bg-red-50 text-red-500 rounded-2xl group-hover:bg-red-500 group-hover:text-white transition-colors">
                            <Coin size={24} variant="Bold" />
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--color-text-secondary)] font-bold text-sm mb-1">Total Revenue</div>
                        <div className="text-3xl font-black text-[var(--color-brand-navy)]">{isLoading ? <Skeleton className="h-8 w-36 rounded-lg" /> : `${formatAmount(revenue, { maximumFractionDigits: 2 })} ${settlementSymbol}`}</div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-[32px] border-2 border-black/5 flex flex-col justify-between h-40 group hover:border-blue-500/20 transition-colors">
                    <div className="flex items-start justify-between">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <Receipt1 size={24} variant="Bold" />
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--color-text-secondary)] font-bold text-sm mb-1">Transactions</div>
                        <div className="text-3xl font-black text-[var(--color-brand-navy)]">{isLoading ? <Skeleton className="h-8 w-20 rounded-lg" /> : txCount}</div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-[32px] border-2 border-black/5 flex flex-col justify-between h-40 group hover:border-purple-500/20 transition-colors">
                    <div className="flex items-start justify-between">
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl group-hover:bg-purple-600 group-hover:text-white transition-colors">
                            <Box size={24} variant="Bold" />
                        </div>
                    </div>
                    <div>
                        <div className="text-[var(--color-text-secondary)] font-bold text-sm mb-1">Active Items</div>
                        <div className="text-3xl font-black text-[var(--color-brand-navy)]">{isLoading ? <Skeleton className="h-8 w-20 rounded-lg" /> : items}</div>
                    </div>
                </div>
            </div>

            {/* Revenue Chart */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="bg-white rounded-[40px] border-2 border-black/5 p-8"
            >
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-[var(--color-brand-navy)]">Revenue</h3>
                    <div className="flex items-center gap-2">
                        {(['7d', '30d', '90d'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
                                    period === p
                                        ? 'bg-black text-white shadow-[2px_2px_0px_0px_#FF5C16]'
                                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-base)] hover:text-[var(--color-brand-navy)]'
                                }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>

                {analyticsLoading ? (
                    <ChartSkeleton height={200} />
                ) : (
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={(analytics?.chart ?? []).map((d: ChartEntry) => ({ ...d, revenue: parseAmountInput(d.revenue) ?? 0 }))}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 11, fontWeight: 600, fill: '#9ca3af' }}
                                tickFormatter={(val: string) => val.slice(5)}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 11, fontWeight: 600, fill: '#9ca3af' }}
                                axisLine={false}
                                tickLine={false}
                                width={40}
                            />
                            <Tooltip
                                contentStyle={{
                                    borderRadius: '12px',
                                    border: '2px solid rgba(0,0,0,0.05)',
                                    fontWeight: 600,
                                    fontSize: 13,
                                }}
                                formatter={(value: number) => [`${value} ${settlementSymbol}`, 'Revenue']}
                            />
                            <Line
                                type="monotone"
                                dataKey="revenue"
                                stroke="#FF5C16"
                                strokeWidth={2.5}
                                dot={false}
                                activeDot={{ r: 5, fill: '#FF5C16' }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </motion.div>

            {/* Recent Activity */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-[40px] border-2 border-black/5 p-8"
            >
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold text-[var(--color-brand-navy)]">Recent Activity</h3>
                    <button className="text-[var(--color-text-secondary)] font-bold text-sm hover:text-[var(--color-brand-orange)] transition-colors">View All</button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <tbody className="text-sm font-medium text-[var(--color-brand-navy)]">
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}>
                                        <td className="py-3 pl-4">
                                            <div className="flex items-center gap-3">
                                                <Skeleton className="w-10 h-10 rounded-full" />
                                                <div className="space-y-1.5">
                                                    <Skeleton className="h-3.5 w-28 rounded-full" />
                                                    <Skeleton className="h-3 w-20 rounded-full" />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3"><Skeleton className="h-3.5 w-20 rounded-full" /></td>
                                        <td className="py-3"><Skeleton className="h-3.5 w-16 rounded-full" /></td>
                                        <td className="py-3 pr-4 text-right"><Skeleton className="h-6 w-20 rounded-lg ml-auto" /></td>
                                    </tr>
                                ))
                            ) : recentTx.length === 0 ? (
                                <tr><td colSpan={4} className="text-center py-4 text-gray-400">No transactions yet</td></tr>
                            ) : (
                                recentTx.map((tx: any) => (
                                    <tr key={tx.id} className="group hover:bg-[var(--color-bg-base)] transition-colors">
                                        <td className="py-4 pl-4 rounded-l-xl">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                                                    <Coin size={18} variant="Bold" />
                                                </div>
                                                <div>
                                                    <div className="font-bold">Payment Received</div>
                                                    <div className="text-xs text-[var(--color-text-secondary)]">{tx.product}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4">{formatAmount(tx.amount, { maximumFractionDigits: 6 })} {settlementSymbol}</td>
                                        <td className="py-4 text-[var(--color-text-secondary)]">
                                            {new Date(tx.date).toLocaleDateString()}
                                        </td>
                                        <td className="py-4 pr-4 rounded-r-xl text-right">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${tx.status === 'confirmed' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
                                                }`}>
                                                {tx.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
}
