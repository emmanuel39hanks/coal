'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import useSWR from 'swr';
import { TrendUp, Coin, Receipt1, PercentageCircle } from 'iconsax-reactjs';
import { useApi } from '@/lib/api';
import { Skeleton, ChartSkeleton } from '@/components/Skeleton';
import { useAuth } from '@/lib/auth';
import { getApiBaseUrl } from '@/lib/api-base';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
} from 'recharts';
import { formatAmount, parseAmountInput } from '@/lib/utils';
import { getSettlementToken } from '@/lib/chain';

type Period = 'today' | '7d' | '30d' | 'all';

interface ChartEntry {
    date: string;
    revenue: string;
    count: number;
}

interface TopProduct {
    name: string;
    revenue: string;
    count: number;
}

interface AnalyticsData {
    revenue: { total: string; change: number };
    transactions: { total: number; change: number };
    avgOrderValue: { total: string; change: number };
    conversionRate: number;
    chart: ChartEntry[];
    topProducts: TopProduct[];
}

function ChangeTag({ change }: { change: number }) {
    const isPositive = change >= 0;
    return (
        <span
            className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
            }`}
        >
            {isPositive ? '+' : ''}
            {change}%
        </span>
    );
}

const PERIOD_LABELS: Record<Period, string> = {
    today: 'Today',
    '7d': '7 days',
    '30d': '30 days',
    all: 'All time',
};

export default function AnalyticsPage() {
    const { fetcher, request } = useApi();
    const { getAccessToken } = useAuth();
    const [period, setPeriod] = useState<Period>('7d');
    const apiBaseUrl = getApiBaseUrl();

    const { data: analytics, isLoading } = useSWR<AnalyticsData>(
        `/api/console/analytics?period=${period}`,
        fetcher
    );
    const settlementSymbol = getSettlementToken().symbol;

    const chartData = (analytics?.chart ?? []).map((d) => ({
        ...d,
        revenue: parseAmountInput(d.revenue) ?? 0,
    }));

    async function handleExport() {
        const token = await getAccessToken();
        const res = await fetch(`${apiBaseUrl}/api/console/export`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const today = new Date().toISOString().slice(0, 10);
        a.download = `coal-transactions-${today}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between"
            >
                <div>
                    <h1 className="text-3xl font-black text-[var(--color-brand-navy)] tracking-tight">Analytics</h1>
                    <p className="text-[var(--color-text-secondary)] font-medium">
                        Revenue and transaction insights.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Period Selector */}
                    <div className="flex items-center gap-2 bg-white border-2 border-black/5 rounded-full px-2 py-1.5">
                        {([
                            { key: 'today', label: 'Today' },
                            { key: '7d', label: '7 days' },
                            { key: '30d', label: '30 days' },
                            { key: 'all', label: 'All time' },
                        ] as const).map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setPeriod(key)}
                                className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
                                    period === key
                                        ? 'bg-black text-white shadow-[2px_2px_0px_0px_#FF5C16]'
                                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-brand-navy)]'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    {/* Export Button */}
                    <button
                        onClick={handleExport}
                        className="bg-black text-white px-5 py-2.5 rounded-full flex items-center gap-2 text-sm font-bold shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px]"
                    >
                        Export CSV
                    </button>
                </div>
            </motion.div>

            {/* KPI Cards */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"
            >
                {/* Revenue */}
                <div className="bg-white p-6 rounded-[32px] border-2 border-black/5 flex flex-col justify-between h-40 group hover:border-[var(--color-brand-orange)]/20 transition-colors">
                    <div className="flex items-start justify-between">
                        <div className="p-3 bg-red-50 text-red-500 rounded-2xl group-hover:bg-red-500 group-hover:text-white transition-colors">
                            <Coin size={24} variant="Bold" />
                        </div>
                        {!isLoading && analytics && (
                            <ChangeTag change={analytics.revenue.change} />
                        )}
                    </div>
                    <div>
                        <div className="text-[var(--color-text-secondary)] font-bold text-sm mb-1">
                            Revenue ({PERIOD_LABELS[period]})
                        </div>
                        <div className="text-3xl font-black text-[var(--color-brand-navy)]">
                            {isLoading ? <Skeleton className="h-8 w-36 rounded-lg" /> : `${formatAmount(analytics?.revenue.total ?? 0, { maximumFractionDigits: 2 })} ${settlementSymbol}`}
                        </div>
                    </div>
                </div>

                {/* Transactions */}
                <div className="bg-white p-6 rounded-[32px] border-2 border-black/5 flex flex-col justify-between h-40 group hover:border-blue-500/20 transition-colors">
                    <div className="flex items-start justify-between">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <Receipt1 size={24} variant="Bold" />
                        </div>
                        {!isLoading && analytics && (
                            <ChangeTag change={analytics.transactions.change} />
                        )}
                    </div>
                    <div>
                        <div className="text-[var(--color-text-secondary)] font-bold text-sm mb-1">
                            Transactions ({PERIOD_LABELS[period]})
                        </div>
                        <div className="text-3xl font-black text-[var(--color-brand-navy)]">
                            {isLoading ? <Skeleton className="h-8 w-20 rounded-lg" /> : (analytics?.transactions.total ?? 0)}
                        </div>
                    </div>
                </div>

                {/* Avg Order Value */}
                <div className="bg-white p-6 rounded-[32px] border-2 border-black/5 flex flex-col justify-between h-40 group hover:border-purple-500/20 transition-colors">
                    <div className="flex items-start justify-between">
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl group-hover:bg-purple-600 group-hover:text-white transition-colors">
                            <TrendUp size={24} variant="Bold" />
                        </div>
                        {!isLoading && analytics && (
                            <ChangeTag change={analytics.avgOrderValue.change} />
                        )}
                    </div>
                    <div>
                        <div className="text-[var(--color-text-secondary)] font-bold text-sm mb-1">
                            Avg Order Value
                        </div>
                        <div className="text-3xl font-black text-[var(--color-brand-navy)]">
                            {isLoading ? <Skeleton className="h-8 w-32 rounded-lg" /> : `${formatAmount(analytics?.avgOrderValue.total ?? 0, { maximumFractionDigits: 2 })} ${settlementSymbol}`}
                        </div>
                    </div>
                </div>

                {/* Conversion Rate */}
                <div className="bg-white p-6 rounded-[32px] border-2 border-black/5 flex flex-col justify-between h-40 group hover:border-emerald-500/20 transition-colors">
                    <div className="flex items-start justify-between">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            <PercentageCircle size={24} variant="Bold" />
                        </div>
                        {/* Conversion rate: show a simple indicator bar */}
                        {!isLoading && analytics != null && (
                            <div className="flex flex-col items-end gap-1">
                                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 rounded-full transition-all"
                                        style={{ width: `${Math.min((analytics.conversionRate ?? 0) * 100, 100)}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <div>
                        <div className="text-[var(--color-text-secondary)] font-bold text-sm mb-1">
                            Conversion Rate
                        </div>
                        <div className="text-3xl font-black text-[var(--color-brand-navy)]">
                            {isLoading
                                ? <Skeleton className="h-8 w-24 rounded-lg" />
                                : `${(((analytics?.conversionRate ?? 0) * 100).toFixed(1))}%`}
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Revenue Line Chart */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-[40px] border-2 border-black/5 p-8"
            >
                <h3 className="text-xl font-bold text-[var(--color-brand-navy)] mb-6">Revenue over time</h3>
                {isLoading ? (
                    <ChartSkeleton height={220} />
                ) : (
                    <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={chartData}>
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
                                width={45}
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

            {/* Transaction Count Bar Chart */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-white rounded-[40px] border-2 border-black/5 p-8"
            >
                <h3 className="text-xl font-bold text-[var(--color-brand-navy)] mb-6">
                    Transactions over time
                </h3>
                {isLoading ? (
                    <ChartSkeleton height={220} />
                ) : (
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 11, fontWeight: 600, fill: '#9ca3af' }}
                                tickFormatter={(val: string) => val.slice(5)}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                allowDecimals={false}
                                tick={{ fontSize: 11, fontWeight: 600, fill: '#9ca3af' }}
                                axisLine={false}
                                tickLine={false}
                                width={35}
                            />
                            <Tooltip
                                contentStyle={{
                                    borderRadius: '12px',
                                    border: '2px solid rgba(0,0,0,0.05)',
                                    fontWeight: 600,
                                    fontSize: 13,
                                }}
                                formatter={(value: number) => [value, 'Transactions']}
                            />
                            <Bar
                                dataKey="count"
                                fill="#0A1628"
                                radius={[6, 6, 0, 0]}
                                maxBarSize={32}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </motion.div>

            {/* Top Products */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-[40px] border-2 border-black/5 p-8"
            >
                <h3 className="text-xl font-bold text-[var(--color-brand-navy)] mb-6">Top Products</h3>
                {isLoading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="flex items-center justify-between py-3">
                                <Skeleton className="h-4 w-40 rounded-full" />
                                <Skeleton className="h-4 w-20 rounded-full" />
                                <Skeleton className="h-4 w-10 rounded-full" />
                            </div>
                        ))}
                    </div>
                ) : !analytics?.topProducts?.length ? (
                    <div className="text-center py-6 text-gray-400 font-medium">
                        No data for this period
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm font-medium text-[var(--color-brand-navy)]">
                            <thead>
                                <tr className="text-[var(--color-text-secondary)] text-xs font-bold uppercase tracking-wider">
                                    <th className="text-left pb-4">Product</th>
                                    <th className="text-right pb-4">Revenue ({settlementSymbol})</th>
                                    <th className="text-right pb-4">Sales</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analytics.topProducts.map((product, i) => (
                                    <tr
                                        key={i}
                                        className="group hover:bg-[var(--color-bg-base)] transition-colors"
                                    >
                                        <td className="py-4 pl-4 rounded-l-xl font-bold">
                                            {product.name}
                                        </td>
                                        <td className="py-4 text-right font-bold text-[var(--color-brand-orange)]">
                                            {product.revenue}
                                        </td>
                                        <td className="py-4 pr-4 text-right rounded-r-xl">
                                            {product.count}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
