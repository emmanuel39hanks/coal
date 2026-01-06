'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Wallet, TickCircle, EmptyWallet } from 'iconsax-reactjs';
import useSWR, { mutate } from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function SettingsPage() {
    const { data: user, error, isLoading } = useSWR('/api/console/settings', fetcher);
    const [name, setName] = useState('');
    const [payoutAddress, setPayoutAddress] = useState('');
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setPayoutAddress(user.payoutAddress || '');
        }
    }, [user]);

    const handleSave = async () => {
        setSaving(true);
        setSuccess(false);
        try {
            const res = await fetch('/api/console/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, payoutAddress })
            });

            if (res.ok) {
                mutate('/api/console/settings');
                setSuccess(true);
                setTimeout(() => setSuccess(false), 3000);
            } else {
                alert('Failed to save settings');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    if (isLoading) return <div className="text-center py-20 text-gray-400">Loading settings...</div>;

    return (
        <div className="space-y-8 max-w-2xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center md:text-left"
            >
                <h1 className="text-3xl font-black text-[var(--color-brand-navy)] tracking-tight">Settings</h1>
                <p className="text-[var(--color-text-secondary)] font-medium">Manage your profile and payouts.</p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-[40px] border-2 border-black/5 p-8 shadow-sm"
            >
                <div className="space-y-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2 pl-4">
                            <User size={18} variant="Bold" className="text-[var(--color-brand-orange)]" />
                            <label className="text-sm font-bold text-[var(--color-brand-navy)]">Display Name</label>
                        </div>
                        <input
                            value={name} onChange={e => setName(e.target.value)}
                            className="w-full h-14 px-6 rounded-full bg-gray-100 border-2 border-transparent focus:border-[var(--color-brand-orange)] outline-none font-medium text-[var(--color-brand-navy)]"
                            placeholder="Store Name"
                        />
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-2 pl-4">
                            <EmptyWallet size={18} variant="Bold" className="text-[var(--color-brand-orange)]" />
                            <label className="text-sm font-bold text-[var(--color-brand-navy)]">MNEE Payout Address</label>
                        </div>
                        <input
                            value={payoutAddress} onChange={e => setPayoutAddress(e.target.value)}
                            className="w-full h-14 px-6 rounded-full bg-gray-100 border-2 border-transparent focus:border-[var(--color-brand-orange)] outline-none font-mono text-sm text-[var(--color-brand-navy)]"
                            placeholder="0x..."
                        />
                        <p className="text-xs text-[var(--color-text-secondary)] pl-4 mt-2 mb-4">
                            Funds from sales will be settled to this address on Mainnet.
                        </p>
                        <div className="pl-4 text-xs font-medium text-gray-400 flex flex-wrap gap-x-4 gap-y-2">
                            <span>Supported wallets:</span>
                            <a href="https://metamask.io" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-brand-orange)] transition-colors underline decoration-dotted">MetaMask</a>
                            <a href="https://wallet.coinbase.com" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-brand-orange)] transition-colors underline decoration-dotted">Coinbase Wallet</a>
                            <a href="https://rainbow.me" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-brand-orange)] transition-colors underline decoration-dotted">Rainbow</a>
                        </div>
                    </div>

                    <div className="pt-4">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className={`w-full h-14 rounded-full font-bold text-lg flex items-center justify-center gap-2 transition-all border-2 border-black ${success
                                ? 'bg-white text-[#27AE60] shadow-[4px_4px_0px_0px_#27AE60] translate-x-[2px] translate-y-[2px]'
                                : 'bg-black text-white shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none'
                                }`}
                        >
                            {saving ? 'Saving...' : success ? (
                                <>
                                    <TickCircle size={20} variant="Bold" />
                                    Saved!
                                </>
                            ) : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
