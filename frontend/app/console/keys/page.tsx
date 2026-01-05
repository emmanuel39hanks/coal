'use client';

import { motion } from 'framer-motion';
import { Add, Copy, Eye, Key, Trash } from 'iconsax-reactjs';

export default function KeysPage() {
    return (
        <div className="space-y-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
                <div>
                    <h1 className="text-3xl font-black text-[var(--color-brand-navy)] tracking-tight">API Keys</h1>
                    <p className="text-[var(--color-text-secondary)] font-medium">Manage access tokens for your applications.</p>
                </div>
                <div className="flex gap-3">
                    <button className="bg-black text-white px-5 py-2.5 rounded-full flex items-center gap-2 text-sm font-bold shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px]">
                        <Add size={18} variant="Linear" />
                        Create New Key
                    </button>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-6"
            >
                {[1, 2].map((i) => (
                    <div key={i} className="bg-white rounded-[32px] border-2 border-black/5 p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-purple-100 text-[var(--color-brand-navy)] rounded-2xl">
                                <Key size={24} variant="Bold" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-lg font-bold text-[var(--color-brand-navy)]">Production Key {i}</h3>
                                    <span className="bg-green-50 text-green-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-green-100">
                                        Active
                                    </span>
                                </div>
                                <p className="text-sm text-[var(--color-text-secondary)] font-mono">pk_live_51M...x92</p>
                                <p className="text-xs text-[var(--color-text-secondary)] mt-2">Created: Jan 5, 2026</p>
                            </div>
                        </div>

                        <div className="flex gap-2 w-full md:w-auto">
                            <button className="flex-1 md:flex-none h-12 px-6 rounded-xl bg-[var(--color-bg-base)] text-[var(--color-brand-navy)] font-bold hover:bg-gray-100 transition-colors flex items-center justify-center gap-2">
                                <Eye size={18} variant="Linear" />
                                Reveal
                            </button>
                            <button className="h-12 w-12 rounded-xl bg-[var(--color-bg-base)] text-[var(--color-brand-navy)] hover:bg-gray-100 transition-colors flex items-center justify-center">
                                <Copy size={18} variant="Linear" />
                            </button>
                            <button className="h-12 w-12 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors flex items-center justify-center">
                                <Trash size={18} variant="Linear" />
                            </button>
                        </div>
                    </div>
                ))}
            </motion.div>
        </div>
    );
}
