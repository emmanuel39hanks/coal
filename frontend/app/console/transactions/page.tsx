'use client';

import { motion } from 'framer-motion';
import { ExportSquare, FilterSearch, SearchNormal } from 'iconsax-reactjs';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';

export default function TransactionsPage() {
    const { data, error, isLoading } = useSWR('/api/console/transactions', fetcher);

    const transactions = data?.transactions || [];

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
                    <button className="bg-white text-[var(--color-brand-navy)] px-5 py-2.5 rounded-full flex items-center gap-2 text-sm font-bold border-2 border-black/5 hover:bg-gray-50 transition-colors">
                        <ExportSquare size={18} variant="Bold" />
                        Export CSV
                    </button>
                </div>
            </motion.div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <SearchNormal size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
                    <input
                        type="text"
                        placeholder="Search by ID, product, or customer..."
                        className="w-full h-12 pl-12 pr-4 rounded-full bg-white border-2 border-black/5 focus:border-[var(--color-brand-orange)] transition-colors outline-none font-medium text-[var(--color-brand-navy)] placeholder:text-gray-400"
                    />
                </div>
                <button className="bg-white px-5 h-12 rounded-full flex items-center gap-2 text-sm font-bold border-2 border-black/5 hover:bg-gray-50 transition-colors text-[var(--color-brand-navy)]">
                    <FilterSearch size={18} variant="Bold" />
                    Filter
                </button>
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
                                <th className="pb-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider pl-4">ID</th>
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
                                <tr><td colSpan={6} className="text-center py-8 text-gray-400">No transactions found</td></tr>
                            ) : (
                                transactions.map((tx: any) => (
                                    <tr key={tx.id} className="group hover:bg-[var(--color-bg-base)] transition-colors">
                                        <td className="py-4 pl-4 rounded-l-xl font-mono text-xs text-gray-500">
                                            {tx.id.substring(0, 8)}...
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
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${tx.status === 'Confirmed' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
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
