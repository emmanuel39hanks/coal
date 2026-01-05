'use client';

import { motion } from 'framer-motion';
import { ArrowUp2, Add, Key, ReceiptItem } from 'iconsax-reactjs';
import Link from 'next/link';

export default function ConsoleOverview() {
    return (
        <div className="space-y-8">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
                <div>
                    <h1 className="text-3xl font-black text-[var(--color-brand-navy)] tracking-tight">Overview</h1>
                    <p className="text-[var(--color-text-secondary)] font-medium">Welcome back, Satoshi.</p>
                </div>
                <div className="flex gap-3">
                    <Link href="/console/keys">
                        <button className="bg-white text-[var(--color-brand-navy)] px-5 py-2.5 rounded-full flex items-center gap-2 text-sm font-bold border-2 border-black/5 hover:bg-gray-50 transition-colors">
                            <Key size={18} variant="Bold" />
                            Create Key
                        </button>
                    </Link>
                    <Link href="/console/products">
                        <button className="bg-black text-white px-5 py-2.5 rounded-full flex items-center gap-2 text-sm font-bold shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px]">
                            <Add size={18} variant="Linear" />
                            New Product
                        </button>
                    </Link>
                </div>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white p-6 rounded-[32px] border-2 border-black/5 shadow-sm"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-[var(--color-brand-lavender)]/20 text-[var(--color-brand-lavender)] rounded-2xl rounded-tr-none">
                            <ReceiptItem size={24} variant="Bold" />
                        </div>
                        <div className="flex items-center gap-1 text-green-500 font-bold text-sm bg-green-50 px-2 py-1 rounded-full">
                            <ArrowUp2 size={12} variant="Bold" />
                            <span>12%</span>
                        </div>
                    </div>
                    <p className="text-[var(--color-text-secondary)] font-medium text-sm">Total Revenue</p>
                    <h3 className="text-4xl font-black text-[var(--color-brand-navy)] tracking-tight">4,290 <span className="text-lg text-[var(--color-text-secondary)] font-bold">MNEE</span></h3>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white p-6 rounded-[32px] border-2 border-black/5 shadow-sm"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-[var(--color-brand-blue)]/20 text-[var(--color-brand-blue)] rounded-2xl rounded-tr-none">
                            <ReceiptItem size={24} variant="Bold" />
                        </div>
                        <div className="flex items-center gap-1 text-green-500 font-bold text-sm bg-green-50 px-2 py-1 rounded-full">
                            <ArrowUp2 size={12} variant="Bold" />
                            <span>8%</span>
                        </div>
                    </div>
                    <p className="text-[var(--color-text-secondary)] font-medium text-sm">Active Transactions</p>
                    <h3 className="text-4xl font-black text-[var(--color-brand-navy)] tracking-tight">142</h3>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white p-6 rounded-[32px] border-2 border-black/5 shadow-sm"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-[var(--color-brand-orange)]/20 text-[var(--color-brand-orange)] rounded-2xl rounded-tr-none">
                            <ReceiptItem size={24} variant="Bold" />
                        </div>
                    </div>
                    <p className="text-[var(--color-text-secondary)] font-medium text-sm">Pending Payouts</p>
                    <h3 className="text-4xl font-black text-[var(--color-brand-navy)] tracking-tight">125 <span className="text-lg text-[var(--color-text-secondary)] font-bold">MNEE</span></h3>
                </motion.div>
            </div>

            {/* Recent Activity */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white rounded-[40px] border-2 border-black/5 p-8"
            >
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold text-[var(--color-brand-navy)]">Recent Transactions</h3>
                    <Link href="/console/transactions" className="text-sm font-bold text-[var(--color-brand-orange)] hover:underline">
                        View All
                    </Link>
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
                            {[1, 2, 3, 4, 5].map((i) => (
                                <tr key={i} className="group hover:bg-[var(--color-bg-base)] transition-colors">
                                    <td className="py-4 pl-4 rounded-l-xl font-mono text-xs">tx_8f3a...9d2</td>
                                    <td className="py-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-50 text-green-700 text-xs font-bold border border-green-100">
                                            Payment
                                        </span>
                                    </td>
                                    <td className="py-4">25.00 MNEE</td>
                                    <td className="py-4 text-[var(--color-text-secondary)]">2 min ago</td>
                                    <td className="py-4 pr-4 rounded-r-xl text-right">
                                        <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                                        Confirmed
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
