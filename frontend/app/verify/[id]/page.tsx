'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { getApiBaseUrl } from '@/lib/api-base';

interface ProofTrail {
    storage: {
        storageUri: string;
        storageRoot: string;
        storageTxHash: string;
        payloadHash: string;
        explorerUrl: string | null;
        publishedAt: string;
    } | null;
    chain: {
        anchorTxHash: string;
        anchorContract: string;
        anchorChainId: number;
        payloadHash: string;
        explorerUrl: string;
        anchoredAt: string;
    } | null;
}

interface ReceiptData {
    checkoutId: string;
    status: string;
    verified: boolean;
    merchant?: { name: string | null };
    payment?: {
        amount: string;
        currency: string;
        description: string | null;
        txHash: string;
        explorerUrl: string;
        paidAt: string;
    };
    proofTrail: ProofTrail | null;
}

type StepStatus = 'confirmed' | 'pending' | 'missing';

function CopyBtn({ text }: { text: string }) {
    const [ok, setOk] = useState(false);
    return (
        <button
            onClick={async () => { await navigator.clipboard.writeText(text).catch(() => {}); setOk(true); setTimeout(() => setOk(false), 1500); }}
            className="shrink-0 text-[10px] font-bold text-gray-400 hover:text-[var(--color-brand-navy)] transition-colors"
        >
            {ok ? '✓' : 'Copy'}
        </button>
    );
}

function Badge({ status }: { status: StepStatus }) {
    if (status === 'confirmed') return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[10px] font-bold text-green-700">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M8 3L4 7L2 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Verified
        </span>
    );
    if (status === 'pending') return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-600">Pending</span>
    );
    return (
        <span className="inline-flex items-center rounded-full bg-gray-50 border border-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-400">Pending</span>
    );
}

export default function ReceiptVerifyPage() {
    const params = useParams();
    const id = params.id as string;
    const [receipt, setReceipt] = useState<ReceiptData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        if (!/^[a-z0-9]{20,36}$/.test(id)) { setError('Invalid receipt ID'); setLoading(false); return; }
        setLoading(true);
        fetch(`${getApiBaseUrl()}/api/receipts/${encodeURIComponent(id)}`)
            .then(r => r.json())
            .then(data => { setReceipt(data); setLoading(false); })
            .catch(() => { setError('Failed to load receipt'); setLoading(false); });
    }, [id]);

    if (loading) return (
        <div className="min-h-screen bg-[#F5F2ED] flex items-center justify-center">
            <svg className="animate-spin h-6 w-6 text-[var(--color-brand-navy)]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                <path className="opacity-80" d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
            </svg>
        </div>
    );

    if (error || !receipt) return (
        <div className="min-h-screen bg-[#F5F2ED] flex items-center justify-center">
            <div className="text-center">
                <h1 className="text-xl font-black text-[var(--color-brand-navy)] mb-2">Receipt not found</h1>
                <p className="text-sm text-gray-500">This checkout ID does not exist or is still pending.</p>
            </div>
        </div>
    );

    if (!receipt.verified || !receipt.payment) return (
        <div className="min-h-screen bg-[#F5F2ED] flex items-center justify-center">
            <div className="text-center">
                <h1 className="text-xl font-black text-[var(--color-brand-navy)] mb-2">Payment Pending</h1>
                <p className="text-sm text-gray-500">Status: <span className="font-bold text-amber-600">{receipt.status}</span></p>
            </div>
        </div>
    );

    const trail = receipt.proofTrail;
    const steps: { n: number; title: string; sub: string; status: StepStatus; hash?: string | null; time?: string | null; url?: string | null; urlLabel?: string }[] = [
        {
            n: 1, title: 'Payment on Base', sub: 'USDC transfer confirmed on-chain',
            status: 'confirmed', hash: receipt.payment.txHash, time: receipt.payment.paidAt,
            url: receipt.payment.explorerUrl, urlLabel: 'BaseScan',
        },
        {
            n: 2, title: 'Receipt on 0G Storage', sub: 'Immutable receipt published to 0G decentralized storage',
            status: trail?.storage ? 'confirmed' : 'missing',
            hash: trail?.storage?.payloadHash, time: trail?.storage?.publishedAt,
            url: trail?.storage?.explorerUrl, urlLabel: 'StorageScan',
        },
        {
            n: 3, title: 'Anchor on 0G Chain', sub: 'Receipt hash anchored on 0G Chain for tamper-proof verification',
            status: trail?.chain ? 'confirmed' : 'pending',
            hash: trail?.chain?.anchorTxHash, time: trail?.chain?.anchoredAt,
            url: trail?.chain?.explorerUrl, urlLabel: 'ChainScan',
        },
    ];
    const stepsOk = steps.filter(s => s.status === 'confirmed').length;

    const details: { label: string; value: string }[] = [
        { label: 'Checkout ID', value: receipt.checkoutId },
        ...(trail?.storage?.storageUri ? [{ label: 'Storage URI', value: trail.storage.storageUri }] : []),
        ...(trail?.storage?.storageRoot ? [{ label: 'Storage Root', value: trail.storage.storageRoot }] : []),
        ...(trail?.chain?.anchorContract ? [{ label: 'Anchor Contract', value: trail.chain.anchorContract }] : []),
        ...(trail?.chain?.anchorChainId ? [{ label: '0G Chain ID', value: String(trail.chain.anchorChainId) }] : []),
    ];

    return (
        <div className="min-h-screen bg-[#F5F2ED] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-[920px]"
            >
                {/* Header row */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M16 6L8 14L4 10" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-[var(--color-brand-navy)] leading-tight">Payment Verified</h1>
                            <p className="text-sm text-gray-500 font-medium">
                                {receipt.payment.amount} {receipt.payment.currency}
                                {receipt.merchant?.name ? ` · ${receipt.merchant.name}` : ''}
                                {receipt.payment.description ? ` · ${receipt.payment.description}` : ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-[11px] font-bold text-gray-400">{stepsOk}/3 verified</span>
                        <button
                            onClick={() => navigator.clipboard.writeText(window.location.href)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand-navy)] px-4 py-2 text-[11px] font-bold text-white hover:opacity-90 transition-opacity"
                        >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 7.5L7.5 4.5M5 3L5.5 2.5A2.12 2.12 0 118.5 5.5L8 6M7 9L6.5 9.5A2.12 2.12 0 113.5 6.5L4 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                            Share
                        </button>
                    </div>
                </div>

                {/* Main grid: Proof Trail + Details side by side */}
                <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4">
                    {/* Proof Trail */}
                    <div className="rounded-[24px] border-2 border-black/5 bg-white p-6">
                        <h2 className="text-[10px] font-black text-[var(--color-brand-navy)] mb-5 uppercase tracking-[0.2em]">Proof Trail</h2>
                        <div className="space-y-0">
                            {steps.map((s, i) => (
                                <div key={s.n} className="flex gap-3.5">
                                    {/* Stepper */}
                                    <div className="flex flex-col items-center">
                                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                                            s.status === 'confirmed' ? 'bg-green-100 text-green-700'
                                                : s.status === 'pending' ? 'bg-amber-50 text-amber-600'
                                                    : 'bg-gray-100 text-gray-400'
                                        }`}>{s.n}</div>
                                        {i < steps.length - 1 && (
                                            <div className={`my-1 w-0.5 flex-1 ${s.status === 'confirmed' ? 'bg-green-200' : 'bg-gray-100'}`} />
                                        )}
                                    </div>
                                    {/* Content */}
                                    <div className={i < steps.length - 1 ? 'pb-5' : ''}>
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-[13px] font-black text-[var(--color-brand-navy)]">{s.title}</span>
                                            <Badge status={s.status} />
                                        </div>
                                        <p className="text-[11px] text-gray-400 font-medium mb-1.5">{s.sub}</p>
                                        {s.hash && (
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-mono text-gray-400 truncate max-w-[320px]">{s.hash}</span>
                                                <CopyBtn text={s.hash} />
                                            </div>
                                        )}
                                        {s.time && (
                                            <p className="text-[10px] text-gray-300 font-medium mb-1">{new Date(s.time).toLocaleString()}</p>
                                        )}
                                        {s.url && (
                                            <a href={s.url} target="_blank" rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FF5C16] hover:underline">
                                                View on {s.urlLabel}
                                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3 7L7 3M7 3H4M7 3V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Details sidebar */}
                    <div className="flex flex-col gap-4">
                        <div className="rounded-[20px] border-2 border-black/5 bg-white p-5">
                            <h3 className="text-[10px] font-black text-[var(--color-brand-navy)] mb-4 uppercase tracking-[0.2em]">Details</h3>
                            <div className="space-y-3">
                                {details.map(d => (
                                    <div key={d.label}>
                                        <dt className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{d.label}</dt>
                                        <dd className="flex items-center gap-1.5">
                                            <span className="text-[11px] font-mono text-[var(--color-brand-navy)] truncate">{d.value}</span>
                                            <CopyBtn text={d.value} />
                                        </dd>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Quick summary card */}
                        <div className="rounded-[20px] bg-[var(--color-brand-navy)] p-5 text-white">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="h-2 w-2 rounded-full bg-[#FF5C16]" />
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Settlement</span>
                            </div>
                            <div className="space-y-2 text-[11px]">
                                <div className="flex justify-between">
                                    <span className="text-white/40 font-medium">Amount</span>
                                    <span className="font-bold">{receipt.payment.amount} {receipt.payment.currency}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-white/40 font-medium">Network</span>
                                    <span className="font-bold">Base</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-white/40 font-medium">Merchant</span>
                                    <span className="font-bold">{receipt.merchant?.name || '—'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-white/40 font-medium">Paid</span>
                                    <span className="font-bold">{new Date(receipt.payment.paidAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <p className="text-center text-[10px] text-gray-400 font-medium">
                            Powered by <span className="font-bold text-[var(--color-brand-navy)]">Coal</span> x <span className="font-bold text-[var(--color-brand-navy)]">0G</span>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
