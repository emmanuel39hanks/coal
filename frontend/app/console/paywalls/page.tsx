'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Add, Copy, TickCircle, Lock, Trash, SearchNormal1, ExportSquare, Flash } from 'iconsax-reactjs';
import useSWR, { mutate } from 'swr';
import Modal from '@/components/Modal';
import { useApi } from '@/lib/api';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/api-errors';
import { getSettlementToken } from '@/lib/chain';
import { getApiBaseUrl } from '@/lib/api-base';

const CONTENT_TYPE_LABELS: Record<string, string> = {
    api: 'API endpoint',
    content: 'Content page',
    download: 'File download',
};

const PRICING_MODEL_LABELS: Record<string, string> = {
    one_time: 'One-time',
    per_call: 'Per call',
};

export default function PaywallsPage() {
    const { fetcher, request: apiRequest } = useApi();
    const toast = useToast();
    const { data, isLoading, error } = useSWR('/api/console/paywalls', fetcher);
    const settlementSymbol = getSettlementToken().symbol;

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [contentType, setContentType] = useState<'api' | 'content' | 'download'>('api');
    const [contentUrl, setContentUrl] = useState('');
    const [pricingModel, setPricingModel] = useState<'one_time' | 'per_call'>('one_time');

    const resetForm = () => {
        setName('');
        setDescription('');
        setPrice('');
        setContentType('api');
        setContentUrl('');
        setPricingModel('one_time');
    };

    const handleCreate = async () => {
        if (!name.trim() || !price) return;
        setCreateLoading(true);
        try {
            await apiRequest('/api/console/paywalls', {
                method: 'POST',
                body: JSON.stringify({
                    name: name.trim(),
                    description: description.trim() || undefined,
                    price,
                    contentType,
                    contentUrl: contentUrl.trim() || undefined,
                    pricingModel,
                }),
            });
            mutate('/api/console/paywalls');
            toast('success', 'Paywall created and published to 0G');
            setIsCreateOpen(false);
            resetForm();
        } catch (e) {
            toast('error', getErrorMessage(e, 'Failed to create paywall'));
        } finally {
            setCreateLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this paywall? It will be deactivated and the 0G manifest updated.')) return;
        try {
            await apiRequest(`/api/console/paywalls/${id}`, { method: 'DELETE' });
            mutate('/api/console/paywalls');
            toast('success', 'Paywall deleted');
        } catch (e) {
            toast('error', getErrorMessage(e, 'Failed to delete paywall'));
        }
    };

    const copyVerifyUrl = (id: string) => {
        const url = `${getApiBaseUrl()}/api/paywalls/${id}/verify`;
        navigator.clipboard.writeText(url);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const paywalls: any[] = data?.paywalls ?? [];
    const filtered = paywalls.filter((p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between"
            >
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-[var(--color-brand-navy)]">Paywalls</h1>
                    <p className="text-[var(--color-text-secondary)] font-medium">
                        Gate any URL or API with an x402 payment. Manifests auto-publish to 0G so AI agents can discover and pay.
                    </p>
                </div>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white shadow-[4px_4px_0px_0px_#FF5C16] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#FF5C16]"
                >
                    <Add size={18} variant="Linear" />
                    New Paywall
                </button>
            </motion.div>

            {/* Search */}
            {(paywalls.length > 0 || searchTerm) && (
                <div className="relative max-w-sm">
                    <SearchNormal1 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
                    <input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search paywalls…"
                        className="w-full rounded-2xl border-2 border-black/5 bg-white pl-10 pr-4 py-2.5 text-sm font-medium focus:outline-none focus:border-[var(--color-brand-orange)]/30"
                    />
                </div>
            )}

            {/* List */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
            >
                {isLoading ? (
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <Skeleton key={i} className="h-24 w-full rounded-[24px]" />
                        ))}
                    </div>
                ) : error ? (
                    <div className="text-center py-12 text-[var(--color-text-secondary)] font-medium">
                        Failed to load paywalls.
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="rounded-[40px] border-2 border-black/5 bg-white py-20 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-bg-base)]">
                            <Lock size={28} variant="Bold" className="text-[var(--color-text-secondary)]" />
                        </div>
                        <p className="text-base font-bold text-[var(--color-brand-navy)] mb-1">No paywalls yet</p>
                        <p className="text-sm text-[var(--color-text-secondary)] max-w-sm mx-auto mb-6">
                            Create a paywall to gate any URL or API endpoint. Each paywall gets an x402-compatible verify endpoint and is published to 0G Storage so AI agents can discover it.
                        </p>
                        <button
                            onClick={() => setIsCreateOpen(true)}
                            className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-bold text-white shadow-[4px_4px_0px_0px_#FF5C16] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#FF5C16]"
                        >
                            <Add size={16} variant="Linear" />
                            Create your first paywall
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map((paywall) => (
                            <div
                                key={paywall.id}
                                className="group bg-white rounded-[24px] border-2 border-black/5 p-5 flex items-center gap-4 hover:border-[var(--color-brand-orange)]/20 transition-all"
                            >
                                <div className="shrink-0 w-11 h-11 rounded-2xl bg-orange-50 flex items-center justify-center">
                                    <Lock size={20} variant="Bold" className="text-[var(--color-brand-orange)]" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <p className="font-black text-[var(--color-brand-navy)] truncate">{paywall.name}</p>
                                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                                            {PRICING_MODEL_LABELS[paywall.pricingModel] ?? paywall.pricingModel}
                                        </span>
                                        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                                            {CONTENT_TYPE_LABELS[paywall.contentType] ?? paywall.contentType}
                                        </span>
                                    </div>
                                    {paywall.description && (
                                        <p className="text-xs text-[var(--color-text-secondary)] truncate font-medium mb-1">{paywall.description}</p>
                                    )}
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-[var(--color-brand-navy)]">
                                            {paywall.price} {paywall.currency}
                                        </span>
                                        <span className="text-xs text-[var(--color-text-secondary)]">·</span>
                                        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                                            {paywall._count?.accesses ?? 0} access{paywall._count?.accesses === 1 ? '' : 'es'}
                                        </span>
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-green-600">
                                            <Flash size={10} variant="Bold" />
                                            0G
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => copyVerifyUrl(paywall.id)}
                                        className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-brand-navy)] transition-colors px-3 py-2 rounded-xl hover:bg-[var(--color-bg-base)]"
                                        title="Copy verify URL"
                                    >
                                        {copiedId === paywall.id ? (
                                            <TickCircle size={14} variant="Bold" className="text-green-500" />
                                        ) : (
                                            <Copy size={14} variant="Linear" />
                                        )}
                                        {copiedId === paywall.id ? 'Copied' : 'Verify URL'}
                                    </button>
                                    <a
                                        href={`${getApiBaseUrl()}/api/paywalls/${paywall.id}/verify`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-text-secondary)] hover:text-[var(--color-brand-navy)] transition-colors px-3 py-2 rounded-xl hover:bg-[var(--color-bg-base)]"
                                    >
                                        <ExportSquare size={14} variant="Linear" />
                                        Test
                                    </a>
                                    <button
                                        onClick={() => handleDelete(paywall.id)}
                                        className="p-2 rounded-xl text-[var(--color-text-secondary)] hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash size={16} variant="Linear" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </motion.div>

            {/* x402 explainer */}
            {paywalls.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-[32px] border-2 border-black/5 p-6"
                >
                    <h3 className="text-sm font-black text-[var(--color-brand-navy)] mb-3">How it works</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            { step: '1', title: 'Client requests', body: 'Any HTTP client hits your protected URL. Coal returns HTTP 402 with payment terms.' },
                            { step: '2', title: 'Client pays', body: 'Client sends USDC on Base and submits the txHash to the /pay endpoint.' },
                            { step: '3', title: 'Access granted', body: 'Once verified, the /verify endpoint returns 200. Manifests are on 0G so AI agents discover you.' },
                        ].map((item) => (
                            <div key={item.step} className="flex gap-3">
                                <div className="shrink-0 w-6 h-6 rounded-full bg-black text-white text-xs font-black flex items-center justify-center">
                                    {item.step}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-[var(--color-brand-navy)]">{item.title}</p>
                                    <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{item.body}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Create modal */}
            <Modal isOpen={isCreateOpen} onClose={() => { setIsCreateOpen(false); resetForm(); }} title="New Paywall">
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-[var(--color-brand-navy)] mb-1.5">Name *</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Premium API Access"
                            className="w-full rounded-2xl border-2 border-black/8 bg-[var(--color-bg-base)] px-4 py-3 text-sm font-medium focus:outline-none focus:border-[var(--color-brand-orange)]/40"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-[var(--color-brand-navy)] mb-1.5">Description</label>
                        <input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What does this paywall protect?"
                            className="w-full rounded-2xl border-2 border-black/8 bg-[var(--color-bg-base)] px-4 py-3 text-sm font-medium focus:outline-none focus:border-[var(--color-brand-orange)]/40"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-[var(--color-brand-navy)] mb-1.5">Price ({settlementSymbol}) *</label>
                            <input
                                type="number"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                                placeholder="1.00"
                                min="0"
                                step="0.01"
                                className="w-full rounded-2xl border-2 border-black/8 bg-[var(--color-bg-base)] px-4 py-3 text-sm font-medium focus:outline-none focus:border-[var(--color-brand-orange)]/40"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[var(--color-brand-navy)] mb-1.5">Pricing model</label>
                            <select
                                value={pricingModel}
                                onChange={(e) => setPricingModel(e.target.value as any)}
                                className="w-full rounded-2xl border-2 border-black/8 bg-[var(--color-bg-base)] px-4 py-3 text-sm font-medium focus:outline-none focus:border-[var(--color-brand-orange)]/40"
                            >
                                <option value="one_time">One-time</option>
                                <option value="per_call">Per call</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-[var(--color-brand-navy)] mb-1.5">Content type</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['api', 'content', 'download'] as const).map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setContentType(type)}
                                    className={`px-3 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${
                                        contentType === type
                                            ? 'border-black bg-black text-white'
                                            : 'border-black/8 bg-[var(--color-bg-base)] text-[var(--color-text-secondary)] hover:border-black/20'
                                    }`}
                                >
                                    {CONTENT_TYPE_LABELS[type]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-[var(--color-brand-navy)] mb-1.5">Content URL</label>
                        <input
                            value={contentUrl}
                            onChange={(e) => setContentUrl(e.target.value)}
                            placeholder="https://your-api.com/endpoint"
                            className="w-full rounded-2xl border-2 border-black/8 bg-[var(--color-bg-base)] px-4 py-3 text-sm font-medium focus:outline-none focus:border-[var(--color-brand-orange)]/40"
                        />
                        <p className="text-[11px] text-[var(--color-text-secondary)] mt-1.5 font-medium">
                            The URL clients gain access to after payment. Included in the 0G manifest so agents know what they're paying for.
                        </p>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={() => { setIsCreateOpen(false); resetForm(); }}
                            className="flex-1 rounded-full border-2 border-black/8 py-3 text-sm font-bold text-[var(--color-text-secondary)] hover:border-black/20 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={createLoading || !name.trim() || !price}
                            className="flex-1 rounded-full bg-black py-3 text-sm font-bold text-white shadow-[4px_4px_0px_0px_#FF5C16] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#FF5C16] disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0"
                        >
                            {createLoading ? 'Creating…' : 'Create Paywall'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
