'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Add, Key, Copy, CloseCircle, ShieldTick, TickCircle, Trash, Warning2 } from 'iconsax-reactjs';
import useSWR, { mutate } from 'swr';
import { useApi } from '@/lib/api';
import { Skeleton } from '@/components/Skeleton';

interface ApiKey {
    id: string;
    name: string;
    prefix: string;
    createdAt: string;
    lastUsed: string | null;
}

export default function KeysPage() {
    const { fetcher, request } = useApi();
    const { data, error, isLoading } = useSWR('/api/console/keys', fetcher);
    // Keys state
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createdKey, setCreatedKey] = useState<{ name: string, secret: string } | null>(null);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    // Revoke modal state
    const [revokeModal, setRevokeModal] = useState<{ isOpen: boolean; keyId: string | null; keyName: string }>({
        isOpen: false,
        keyId: null,
        keyName: ''
    });
    const [revoking, setRevoking] = useState(false);

    const handleCreate = async () => {
        setLoading(true);
        try {
            const json = await request('/api/console/keys', {
                method: 'POST',
                body: JSON.stringify({ name: createName })
            });
            setCreatedKey(json.key);
            mutate('/api/console/keys');
            setCreateName('');
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleRevoke = async () => {
        if (!revokeModal.keyId) return;

        setRevoking(true);
        try {
            await request(`/api/console/keys/${revokeModal.keyId}`, { method: 'DELETE' });
            mutate('/api/console/keys');
            setRevokeModal({ isOpen: false, keyId: null, keyName: '' });
        } catch (e) {
            console.error('Error revoking key:', e);
        } finally {
            setRevoking(false);
        }
    };

    const keys: ApiKey[] = data?.keys || [];

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
                <div>
                    <h1 className="text-3xl font-black text-[var(--color-brand-navy)] tracking-tight">API Keys</h1>
                    <p className="text-[var(--color-text-secondary)] font-medium">Manage your secret keys.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsCreateOpen(true)}
                        className="bg-black text-white px-5 py-2.5 rounded-full flex items-center gap-2 text-sm font-bold shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px]"
                    >
                        <Add size={18} variant="Linear" />
                        Create New Key
                    </button>
                </div>
            </motion.div>

            {/* Keys Table */}
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
                                <th className="pb-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider pl-4">Name</th>
                                <th className="pb-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Prefix</th>
                                <th className="pb-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Created</th>
                                <th className="pb-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Last Used</th>
                                <th className="pb-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider pr-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm font-medium text-[var(--color-brand-navy)]">
                            {isLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <tr key={i} className="group">
                                        <td className="py-4 pl-4 rounded-l-xl">
                                            <Skeleton className="h-4 w-32 rounded-full" />
                                        </td>
                                        <td className="py-4">
                                            <Skeleton className="h-3.5 w-28 rounded-full font-mono" />
                                        </td>
                                        <td className="py-4"><Skeleton className="h-3.5 w-20 rounded-full" /></td>
                                        <td className="py-4"><Skeleton className="h-3.5 w-16 rounded-full" /></td>
                                        <td className="py-4 pr-4 rounded-r-xl text-right">
                                            <Skeleton className="h-6 w-16 rounded-full ml-auto" />
                                        </td>
                                    </tr>
                                ))
                            ) : keys.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-6 text-gray-400">No active keys</td></tr>
                            ) : (
                                keys.map((key: ApiKey) => (
                                    <tr key={key.id} className="group hover:bg-[var(--color-bg-base)] transition-colors">
                                        <td className="py-4 pl-4 rounded-l-xl font-bold">{key.name}</td>
                                        <td className="py-4 font-mono text-xs">{key.prefix}...</td>
                                        <td className="py-4 text-[var(--color-text-secondary)]">{new Date(key.createdAt).toLocaleDateString()}</td>
                                        <td className="py-4 text-[var(--color-text-secondary)]">
                                            {key.lastUsed ? new Date(key.lastUsed).toLocaleDateString() : 'Never'}
                                        </td>
                                        <td className="py-4 pr-4 rounded-r-xl text-right">
                                            <button
                                                onClick={() => setRevokeModal({ isOpen: true, keyId: key.id, keyName: key.name })}
                                                className="inline-flex items-center gap-1.5 text-red-500 font-bold text-xs hover:text-red-700 hover:underline transition-colors"
                                            >
                                                <Trash size={14} variant="Bold" />
                                                Revoke
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>

            {/* Create Modal */}
            <AnimatePresence>
                {isCreateOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                            onClick={() => {
                                setIsCreateOpen(false);
                                setCreatedKey(null);
                            }}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white w-full max-w-lg rounded-[40px] p-8 relative z-10 shadow-2xl"
                        >
                            <button
                                onClick={() => {
                                    setIsCreateOpen(false);
                                    setCreatedKey(null);
                                }}
                                className="absolute top-6 right-6 text-gray-400 hover:text-black"
                            >
                                <CloseCircle size={24} variant="Bold" />
                            </button>

                            {createdKey ? (
                                <div className="space-y-6">
                                    <div className="flex flex-col items-center text-center">
                                        <div className="w-20 h-20 bg-white border-2 border-[var(--color-brand-navy)] shadow-[4px_4px_0px_0px_#27AE60] rounded-full flex items-center justify-center mb-6 text-[#27AE60]">
                                            <ShieldTick size={40} variant="Bold" />
                                        </div>
                                        <h2 className="text-2xl font-black text-[var(--color-brand-navy)]">Key Created!</h2>
                                        <p className="text-sm text-[var(--color-text-secondary)] mt-2">
                                            Copy this key now. You won't be able to see it again.
                                        </p>
                                    </div>
                                    <div className="bg-gray-100 p-4 rounded-2xl flex items-center justify-between border-2 border-dashed border-gray-300">
                                        <code className="font-mono text-sm break-all">{createdKey.secret}</code>
                                        <button onClick={() => copyToClipboard(createdKey.secret)} className="p-2 hover:bg-white rounded-lg transition-colors relative group">
                                            {copied ? <TickCircle size={20} className="text-[#27AE60]" variant="Bold" /> : <Copy size={20} className="text-[var(--color-brand-orange)]" />}
                                            {copied && (
                                                <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] font-bold py-1 px-2 rounded-lg whitespace-nowrap">
                                                    Copied!
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setIsCreateOpen(false);
                                            setCreatedKey(null);
                                        }}
                                        className="w-full h-14 bg-black text-white rounded-full font-bold"
                                    >
                                        Done
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <h2 className="text-2xl font-black text-[var(--color-brand-navy)] mb-6">New API Key</h2>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-bold text-[var(--color-brand-navy)] mb-2 pl-4">Key Name</label>
                                            <input
                                                value={createName} onChange={e => setCreateName(e.target.value)}
                                                className="w-full h-12 px-6 rounded-full bg-gray-100 border-2 border-transparent focus:border-[var(--color-brand-orange)] outline-none font-medium"
                                                placeholder="e.g. Production Server"
                                            />
                                        </div>
                                        <button
                                            onClick={handleCreate}
                                            disabled={loading}
                                            className="w-full h-14 bg-black text-white rounded-full font-bold text-lg flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px] mt-4"
                                        >
                                            {loading ? 'Generating...' : 'Generate Key'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Revoke Confirmation Modal */}
            <AnimatePresence>
                {revokeModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                            onClick={() => setRevokeModal({ isOpen: false, keyId: null, keyName: '' })}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white w-full max-w-md rounded-[40px] p-8 relative z-10 shadow-2xl"
                        >
                            <div className="flex flex-col items-center text-center">
                                <div className="w-20 h-20 bg-red-50 border-2 border-red-200 rounded-full flex items-center justify-center mb-6 text-red-500">
                                    <Warning2 size={40} variant="Bold" />
                                </div>
                                <h2 className="text-2xl font-black text-[var(--color-brand-navy)]">Revoke API Key?</h2>
                                <p className="text-sm text-[var(--color-text-secondary)] mt-2 mb-6">
                                    Are you sure you want to revoke <strong>&quot;{revokeModal.keyName}&quot;</strong>?
                                    This action cannot be undone and any applications using this key will stop working.
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setRevokeModal({ isOpen: false, keyId: null, keyName: '' })}
                                    className="flex-1 h-12 bg-gray-100 text-[var(--color-brand-navy)] rounded-full font-bold hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRevoke}
                                    disabled={revoking}
                                    className="flex-1 h-12 bg-red-500 text-white rounded-full font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
                                >
                                    {revoking ? 'Revoking...' : 'Yes, Revoke'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
