'use client';

import { motion } from 'framer-motion';
import { Add, Box, SearchNormal1 } from 'iconsax-reactjs';

export default function ProductsPage() {
    return (
        <div className="space-y-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
                <div>
                    <h1 className="text-3xl font-black text-[var(--color-brand-navy)] tracking-tight">Products</h1>
                    <p className="text-[var(--color-text-secondary)] font-medium">Manage your items and pricing.</p>
                </div>
                <div className="flex gap-3">
                    <button className="bg-black text-white px-5 py-2.5 rounded-full flex items-center gap-2 text-sm font-bold shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px]">
                        <Add size={18} variant="Linear" />
                        New Product
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
                            placeholder="Search products..."
                            className="w-full pl-12 pr-4 py-3 rounded-2xl bg-gray-100 border-2 border-transparent focus:border-[var(--color-brand-orange)] outline-none font-medium transition-all placeholder:text-gray-400"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="group p-6 rounded-[32px] border-2 border-black/5 hover:border-[var(--color-brand-orange)] transition-colors bg-white relative">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-[var(--color-bg-base)] flex items-center justify-center text-[var(--color-brand-navy)]">
                                    <Box size={24} variant="Bold" />
                                </div>
                                <span className="bg-green-50 text-green-700 text-xs font-bold px-2 py-1 rounded-lg border border-green-100">
                                    Active
                                </span>
                            </div>
                            <h3 className="text-xl font-bold text-[var(--color-brand-navy)] mb-1">Premium Plan {i}</h3>
                            <p className="text-[var(--color-text-secondary)] text-sm mb-4">SKU: PRO-202{i}</p>

                            <div className="flex items-end gap-1 mb-6">
                                <span className="text-2xl font-black text-[var(--color-brand-navy)]">100</span>
                                <span className="text-sm font-bold text-[var(--color-text-secondary)] mb-1">MNEE</span>
                            </div>

                            <div className="flex items-center justify-between text-sm font-medium pt-4 border-t border-black/5">
                                <span className="text-[var(--color-text-secondary)]">Sold: 24</span>
                                <button className="text-[var(--color-brand-orange)] font-bold hover:underline">Edit</button>
                            </div>
                        </div>
                    ))}

                    <button className="p-6 rounded-[32px] border-2 border-dashed border-black/10 hover:border-[var(--color-brand-orange)] hover:bg-[var(--color-brand-orange)]/5 transition-all flex flex-col items-center justify-center gap-3 text-[var(--color-text-secondary)] hover:text-[var(--color-brand-orange)] min-h-[200px]">
                        <div className="w-12 h-12 rounded-full bg-black/5 flex items-center justify-center group-hover:bg-[var(--color-brand-orange)]/20">
                            <Add size={24} variant="Linear" />
                        </div>
                        <span className="font-bold">Add New Product</span>
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
