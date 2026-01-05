'use client';

import { motion } from 'framer-motion';
import { User, Wallet, Lock } from 'iconsax-reactjs';

export default function SettingsPage() {
    return (
        <div className="space-y-8 max-w-2xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <h1 className="text-3xl font-black text-[var(--color-brand-navy)] tracking-tight">Settings</h1>
                <p className="text-[var(--color-text-secondary)] font-medium">Manage your profile and payout preferences.</p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-[40px] border-2 border-black/5 p-8 space-y-8"
            >
                {/* Profile */}
                <div>
                    <div className="flex items-center gap-2 mb-6 text-[var(--color-brand-navy)]">
                        <User size={24} variant="Bold" />
                        <h2 className="text-xl font-bold">Profile</h2>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-[var(--color-brand-navy)] mb-2 pl-4">Full Name</label>
                            <input
                                type="text"
                                defaultValue="Satoshi Nakamoto"
                                className="w-full h-14 px-6 rounded-full bg-gray-100 border-2 border-transparent focus:border-[var(--color-brand-orange)] focus:bg-white outline-none transition-all font-medium text-[var(--color-brand-navy)] placeholder:text-black/20"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-[var(--color-brand-navy)] mb-2 pl-4">Email</label>
                            <input
                                type="email"
                                defaultValue="satoshi@bitcoin.org"
                                className="w-full h-14 px-6 rounded-full bg-gray-100 border-2 border-transparent focus:border-[var(--color-brand-orange)] focus:bg-white outline-none transition-all font-medium text-[var(--color-brand-navy)] placeholder:text-black/20"
                            />
                        </div>
                    </div>
                </div>

                <div className="w-full border-t border-black/5"></div>

                {/* Payouts */}
                <div>
                    <div className="flex items-center gap-2 mb-6 text-[var(--color-brand-navy)]">
                        <Wallet size={24} variant="Bold" />
                        <h2 className="text-xl font-bold">Payouts</h2>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-[var(--color-brand-navy)] mb-2 pl-4">MNEE Payout Wallet Address</label>
                            <input
                                type="text"
                                placeholder="0x..."
                                className="w-full h-14 px-6 rounded-full bg-gray-100 border-2 border-transparent focus:border-[var(--color-brand-orange)] focus:bg-white outline-none transition-all font-medium text-[var(--color-brand-navy)] placeholder:text-black/20 font-mono text-sm"
                            />
                            <p className="text-xs text-[var(--color-text-secondary)] mt-2 pl-4">
                                All earnings will be automatically settled to this address.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="w-full border-t border-black/5"></div>

                <div className="flex justify-end pt-4">
                    <button className="bg-black text-white px-8 py-3 rounded-full text-base font-bold shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px]">
                        Save Changes
                    </button>
                </div>

            </motion.div>
        </div>
    );
}
