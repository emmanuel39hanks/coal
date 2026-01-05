'use client';

import { motion } from 'framer-motion';
import { SearchNormal1, Filter, ArrowDown2, ExportCurve } from 'iconsax-reactjs';

export default function TransactionsPage() {
    return (
        <div className="space-y-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
                <div>
                    <h1 className="text-3xl font-black text-[var(--color-brand-navy)] tracking-tight">Transactions</h1>
                    <p className="text-[var(--color-text-secondary)] font-medium">View and manage your payments.</p>
                </div>
                <div className="flex gap-3">
                    <button className="bg-white text-[var(--color-brand-navy)] px-5 py-2.5 rounded-full flex items-center gap-2 text-sm font-bold border-2 border-black/5 hover:bg-gray-50 transition-colors">
                        <ExportCurve size={18} variant="Bold" />
                        Export CSV
                    </button>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-[40px] border-2 border-black/5 p-8"
            >
                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 mb-8">
                    <div className="relative flex-1">
                        <SearchNormal1 size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by ID or amount..."
                            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-gray-100 border-2 border-transparent focus:border-[var(--color-brand-orange)] outline-none font-medium transition-all placeholder:text-gray-400"
                        />
                    </div>
                    <button className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-[var(--color-bg-base)] text-[var(--color-brand-navy)] font-bold hover:bg-gray-100 transition-colors">
                        <Filter size={20} variant="Linear" />
                        Filter
                        <ArrowDown2 size={16} variant="Linear" />
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left border-b border-black/5">
                                <th className="pb-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider pl-4">ID</th>
                                <th className="pb-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Type</th>
                                <th className="pb-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Amount</th>
                                <th className="pb-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Date</th>
                                <th className="pb-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider pr-4 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm font-medium text-[var(--color-brand-navy)]">
                            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                                <tr key={i} className="group hover:bg-[var(--color-bg-base)] transition-colors">
                                    <td className="py-4 pl-4 rounded-l-xl font-mono text-xs">tx_8f3a...9d{i}</td>
                                    <td className="py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${i % 3 === 0 ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                                            {i % 3 === 0 ? 'Payout' : 'Payment'}
                                        </span>
                                    </td>
                                    <td className="py-4">{25.00 * i} MNEE</td>
                                    <td className="py-4 text-[var(--color-text-secondary)]">2 min ago</td>
                                    <td className="py-4 pr-4 rounded-r-xl text-right">
                                        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${i % 5 === 0 ? 'bg-red-500' : 'bg-green-500'}`}></span>
                                        {i % 5 === 0 ? 'Failed' : 'Confirmed'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
}
