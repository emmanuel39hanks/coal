'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExportSquare, FilterSearch, SearchNormal, CloseCircle } from 'iconsax-reactjs';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';

export default function TransactionsPage() {
    const { data, error, isLoading } = useSWR('/api/console/transactions', fetcher);

    const allTransactions = data?.transactions || [];

    // Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'Confirmed' | 'Pending' | 'Failed'>('all');
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // Filtered transactions
    const transactions = useMemo(() => {
        return allTransactions.filter((tx: any) => {
            // Search filter
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = !searchQuery ||
                tx.txHash?.toLowerCase().includes(searchLower) ||
                tx.id?.toLowerCase().includes(searchLower) ||
                tx.description?.toLowerCase().includes(searchLower) ||
                tx.type?.toLowerCase().includes(searchLower);

            // Status filter
            const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [allTransactions, searchQuery, statusFilter]);

    // Export transactions as CSV
    const handleExportCSV = () => {
        if (transactions.length === 0) return;

        const headers = ['TX Hash', 'Type', 'Description', 'Amount', 'Currency', 'Date', 'Status'];
        const rows = transactions.map((tx: any) => [
            tx.txHash || tx.id,
            tx.type,
            tx.description || '',
            parseFloat(tx.amount),
            'MNEE',
            new Date(tx.date).toISOString(),
            tx.status
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map((cell: any) => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `coal-transactions-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    // Format TX hash for display (show first 6 and last 4 chars)
    const formatTxHash = (hash: string) => {
        if (!hash || hash.length < 12) return hash?.substring(0, 8) + '...';
        return `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}`;
    };

    // Etherscan URL (mainnet)
    const getEtherscanUrl = (txHash: string) => {
        return `https://etherscan.io/tx/${txHash}`;
    };

    return (
        <div className="space-y-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
                <div>
                    <h1 className="text-3xl font-black text-[var(--color-brand-navy)] tracking-tight">Transactions</h1>
                    <p className="text-[var(--color-text-secondary)] font-medium">Manage and export your payments.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleExportCSV}
                        disabled={transactions.length === 0}
                        className="bg-white text-[var(--color-brand-navy)] px-5 py-2.5 rounded-full flex items-center gap-2 text-sm font-bold border-2 border-black/5 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ExportSquare size={18} variant="Bold" />
                        Export CSV
                    </button>
                </div>
            </motion.div>

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <SearchNormal size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by TX hash, description, or type..."
                        className="w-full h-12 pl-12 pr-4 rounded-full bg-white border-2 border-black/5 focus:border-[var(--color-brand-orange)] transition-colors outline-none font-medium text-[var(--color-brand-navy)] placeholder:text-gray-400"
                    />
                </div>
                <div className="relative">
                    <button
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className={`bg-white px-5 h-12 rounded-full flex items-center gap-2 text-sm font-bold border-2 transition-colors text-[var(--color-brand-navy)] ${statusFilter !== 'all' ? 'border-[var(--color-brand-orange)] bg-orange-50' : 'border-black/5 hover:bg-gray-50'
                            }`}
                    >
                        <FilterSearch size={18} variant="Bold" />
                        Filter
                        {statusFilter !== 'all' && (
                            <span className="ml-1 bg-[var(--color-brand-orange)] text-white text-xs px-2 py-0.5 rounded-full">1</span>
                        )}
                    </button>

                    {/* Filter Dropdown */}
                    <AnimatePresence>
                        {isFilterOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                className="absolute right-0 top-14 bg-white rounded-2xl shadow-xl border-2 border-black/5 p-4 z-20 min-w-[200px]"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-bold text-[var(--color-brand-navy)]">Status</span>
                                    {statusFilter !== 'all' && (
                                        <button
                                            onClick={() => setStatusFilter('all')}
                                            className="text-xs text-[var(--color-brand-orange)] font-bold hover:underline"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {(['all', 'Confirmed', 'Pending', 'Failed'] as const).map((status) => (
                                        <button
                                            key={status}
                                            onClick={() => {
                                                setStatusFilter(status);
                                                setIsFilterOpen(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === status
                                                ? 'bg-[var(--color-brand-orange)] text-white'
                                                : 'hover:bg-gray-100 text-[var(--color-brand-navy)]'
                                                }`}
                                        >
                                            {status === 'all' ? 'All Statuses' : status}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Transactions Table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-[40px] border-2 border-black/5 p-8"
            >
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left border-b border-black/5">
                                <th className="pb-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider pl-4">TX Hash</th>
                                <th className="pb-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Type</th>
                                <th className="pb-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Description</th>
                                <th className="pb-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Amount</th>
                                <th className="pb-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Date</th>
                                <th className="pb-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider pr-4 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm font-medium text-[var(--color-brand-navy)]">
                            {isLoading ? (
                                <tr><td colSpan={6} className="text-center py-8">Loading transactions...</td></tr>
                            ) : transactions.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-8 text-gray-400">
                                    {allTransactions.length > 0 ? 'No transactions match your filters' : 'No transactions found'}
                                </td></tr>
                            ) : (
                                transactions.map((tx: any) => (
                                    <tr key={tx.id} className="group hover:bg-[var(--color-bg-base)] transition-colors">
                                        <td className="py-4 pl-4 rounded-l-xl">
                                            {tx.txHash ? (
                                                <a
                                                    href={getEtherscanUrl(tx.txHash)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-mono text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-800 px-2.5 py-1.5 rounded-lg transition-colors inline-flex items-center gap-2 border border-blue-200"
                                                >
                                                    {formatTxHash(tx.txHash)}
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                    </svg>
                                                </a>
                                            ) : (
                                                <span className="font-mono text-xs text-gray-400 bg-gray-50 px-2.5 py-1.5 rounded-lg">
                                                    {tx.id.substring(0, 8)}...
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-4">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-50 text-green-700 text-xs font-bold border border-green-100">
                                                {tx.type}
                                            </span>
                                        </td>
                                        <td className="py-4">{tx.description}</td>
                                        <td className="py-4 font-bold">{parseFloat(tx.amount)} MNEE</td>
                                        <td className="py-4 text-[var(--color-text-secondary)]">
                                            {new Date(tx.date).toLocaleDateString()}
                                        </td>
                                        <td className="py-4 pr-4 rounded-r-xl text-right">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${tx.status === 'Confirmed' ? 'bg-green-50 text-green-700 border-green-100' :
                                                tx.status === 'Pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                                                    'bg-red-50 text-red-700 border-red-100'
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
