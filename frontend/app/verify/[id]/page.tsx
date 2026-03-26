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

/* ─── Copy Button ─────────────────────────────────────────────────── */

function CopyButton({ text, label }: { text: string; label?: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // fallback
        }
    }, [text]);

    return (
        <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-[#0A1628] transition-colors"
            title={`Copy ${label || 'value'}`}
        >
            {copied ? (
                <>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Copied
                </>
            ) : (
                <>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M8 4V2.5C8 1.67 7.33 1 6.5 1H2.5C1.67 1 1 1.67 1 2.5V6.5C1 7.33 1.67 8 2.5 8H4" stroke="currentColor" strokeWidth="1.2"/></svg>
                    Copy
                </>
            )}
        </button>
    );
}

/* ─── Step Badge ──────────────────────────────────────────────────── */

function StepBadge({ status }: { status: StepStatus }) {
    if (status === 'confirmed') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-700">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Verified
            </span>
        );
    }
    if (status === 'pending') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2"/></svg>
                Pending
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-500">
            Not available
        </span>
    );
}

/* ─── Proof Step ──────────────────────────────────────────────────── */

function ProofStep({
    step,
    title,
    description,
    status,
    explorerUrl,
    explorerLabel,
    hash,
    timestamp,
    isLast,
}: {
    step: number;
    title: string;
    description: string;
    status: StepStatus;
    explorerUrl?: string | null;
    explorerLabel?: string;
    hash?: string | null;
    timestamp?: string | null;
    isLast?: boolean;
}) {
    return (
        <div className="flex gap-4">
            <div className="flex flex-col items-center">
                <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                        status === 'confirmed'
                            ? 'bg-green-100 text-green-700'
                            : status === 'pending'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-100 text-gray-400'
                    }`}
                >
                    {step}
                </div>
                {!isLast && (
                    <div
                        className={`my-1 w-0.5 flex-1 ${
                            status === 'confirmed' ? 'bg-green-200' : 'bg-gray-200'
                        }`}
                    />
                )}
            </div>
            <div className={`pb-8 ${isLast ? 'pb-0' : ''} min-w-0 flex-1`}>
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-black text-[#0A1628]">{title}</h3>
                    <StepBadge status={status} />
                </div>
                <p className="text-xs text-gray-500 font-medium mb-2">{description}</p>
                {hash && (
                    <div className="flex items-center gap-2 mb-1.5">
                        <p className="text-[11px] font-mono text-gray-400 break-all">
                            {hash}
                        </p>
                        <CopyButton text={hash} label="hash" />
                    </div>
                )}
                {timestamp && (
                    <p className="text-[11px] text-gray-400 font-medium mb-1.5">
                        {new Date(timestamp).toLocaleString()}
                    </p>
                )}
                {explorerUrl && (
                    <a
                        href={explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#FF5C16] hover:underline"
                    >
                        {explorerLabel || 'View on Explorer'}
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3.5 8.5L8.5 3.5M8.5 3.5H4.5M8.5 3.5V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </a>
                )}
            </div>
        </div>
    );
}

/* ─── Share Button ────────────────────────────────────────────────── */

function ShareButton() {
    const [shared, setShared] = useState(false);

    const handleShare = useCallback(async () => {
        const url = window.location.href;
        try {
            await navigator.clipboard.writeText(url);
            setShared(true);
            setTimeout(() => setShared(false), 2000);
        } catch {
            // fallback
        }
    }, []);

    return (
        <button
            onClick={handleShare}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all ${
                shared
                    ? 'bg-green-50 text-green-700'
                    : 'bg-[#0A1628] text-white hover:bg-[#0A1628]/90'
            }`}
        >
            {shared ? (
                <>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M11.5 3.5L5.25 9.75L2.5 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Link copied
                </>
            ) : (
                <>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5.5 8.5L8.5 5.5M6 3.5L6.94 2.56C7.88 1.62 9.37 1.62 10.31 2.56L11.44 3.69C12.38 4.63 12.38 6.12 11.44 7.06L10.5 8M8 10.5L7.06 11.44C6.12 12.38 4.63 12.38 3.69 11.44L2.56 10.31C1.62 9.37 1.62 7.88 2.56 6.94L3.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    Share receipt
                </>
            )}
        </button>
    );
}

/* ─── Detail Row ──────────────────────────────────────────────────── */

function DetailRow({ label, value, copyable }: { label: string; value: string; copyable?: boolean }) {
    return (
        <div className="flex justify-between items-start gap-4">
            <dt className="font-bold text-gray-500 shrink-0">{label}</dt>
            <dd className="font-mono text-gray-700 text-right break-all max-w-[300px] flex items-center gap-1.5">
                <span className="truncate">{value}</span>
                {copyable && <CopyButton text={value} label={label} />}
            </dd>
        </div>
    );
}

/* ─── Main Page ───────────────────────────────────────────────────── */

export default function ReceiptVerifyPage() {
    const params = useParams();
    const id = params.id as string;
    const [receipt, setReceipt] = useState<ReceiptData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        if (!/^[a-z0-9]{20,36}$/.test(id)) {
            setError('Invalid receipt ID');
            setLoading(false);
            return;
        }
        setLoading(true);
        fetch(`${getApiBaseUrl()}/api/receipts/${encodeURIComponent(id)}`)
            .then((res) => res.json())
            .then((data) => {
                setReceipt(data);
                setLoading(false);
            })
            .catch(() => {
                setError('Failed to load receipt');
                setLoading(false);
            });
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center">
                        <svg className="animate-spin h-8 w-8 text-[#0A1628]" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                            <path className="opacity-80" d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                        </svg>
                    </div>
                    <p className="text-sm font-bold text-gray-400">Verifying receipt...</p>
                </div>
            </div>
        );
    }

    if (error || !receipt) {
        return (
            <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                            <path d="M14 8V15M14 19V19.01" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round"/>
                        </svg>
                    </div>
                    <h1 className="text-2xl font-black text-[#0A1628] mb-2">Receipt not found</h1>
                    <p className="text-gray-500 font-medium text-sm max-w-sm">
                        This checkout ID does not exist or the payment has not been confirmed yet.
                    </p>
                </div>
            </div>
        );
    }

    if (!receipt.verified || !receipt.payment) {
        return (
            <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
                        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                            <circle cx="14" cy="14" r="10" stroke="#D97706" strokeWidth="2.5" strokeDasharray="5 3"/>
                        </svg>
                    </div>
                    <h1 className="text-2xl font-black text-[#0A1628] mb-2">Payment Pending</h1>
                    <p className="text-gray-500 font-medium text-sm">
                        Status: <span className="font-bold text-amber-600">{receipt.status}</span>. This payment has not been confirmed yet.
                    </p>
                </div>
            </div>
        );
    }

    const trail = receipt.proofTrail;
    const stepsConfirmed = [true, !!trail?.storage, !!trail?.chain].filter(Boolean).length;

    return (
        <div className="min-h-screen bg-[#FAFAF8]">
            <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    {/* Header */}
                    <div className="mb-8 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
                            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                                <path d="M26 10L13 23L6 16" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                        <h1 className="text-3xl font-black text-[#0A1628] mb-1">Payment Verified</h1>
                        <p className="text-lg text-gray-600 font-bold">
                            {receipt.payment.amount} {receipt.payment.currency}
                            {receipt.merchant?.name ? ` to ${receipt.merchant.name}` : ''}
                        </p>
                        {receipt.payment.description && (
                            <p className="text-sm text-gray-400 mt-1">{receipt.payment.description}</p>
                        )}
                        <div className="mt-4 flex items-center justify-center gap-3">
                            <ShareButton />
                            <span className="text-[11px] font-bold text-gray-400">
                                {stepsConfirmed}/3 proofs verified
                            </span>
                        </div>
                    </div>

                    {/* Proof Trail */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="rounded-[32px] border-2 border-black/5 bg-white p-6 sm:p-8"
                    >
                        <h2 className="text-sm font-black text-[#0A1628] mb-6 uppercase tracking-wider">
                            Proof Trail
                        </h2>

                        <ProofStep
                            step={1}
                            title="Payment on Base"
                            description="USDC transfer confirmed on-chain"
                            status="confirmed"
                            explorerUrl={receipt.payment.explorerUrl}
                            explorerLabel="View on BaseScan"
                            hash={receipt.payment.txHash}
                            timestamp={receipt.payment.paidAt}
                        />

                        <ProofStep
                            step={2}
                            title="Receipt on 0G Storage"
                            description="Immutable receipt payload published to 0G decentralized storage"
                            status={trail?.storage ? 'confirmed' : 'missing'}
                            explorerUrl={trail?.storage?.explorerUrl}
                            explorerLabel="View on StorageScan"
                            hash={trail?.storage?.payloadHash}
                            timestamp={trail?.storage?.publishedAt}
                        />

                        <ProofStep
                            step={3}
                            title="Anchor on 0G Chain"
                            description="Receipt hash anchored on 0G Chain for tamper-proof verification"
                            status={trail?.chain ? 'confirmed' : 'missing'}
                            explorerUrl={trail?.chain?.explorerUrl}
                            explorerLabel="View on ChainScan"
                            hash={trail?.chain?.anchorTxHash}
                            timestamp={trail?.chain?.anchoredAt}
                            isLast
                        />
                    </motion.div>

                    {/* Technical Details */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="mt-4 rounded-[24px] border-2 border-black/5 bg-white p-6"
                    >
                        <h3 className="text-xs font-black text-[#0A1628] mb-4 uppercase tracking-wider">
                            Verification Details
                        </h3>
                        <dl className="space-y-3 text-xs">
                            <DetailRow label="Checkout ID" value={receipt.checkoutId} copyable />
                            {trail?.storage?.storageUri && (
                                <DetailRow label="Storage URI" value={trail.storage.storageUri} copyable />
                            )}
                            {trail?.storage?.storageRoot && (
                                <DetailRow label="Storage Root" value={trail.storage.storageRoot} copyable />
                            )}
                            {trail?.chain?.anchorContract && (
                                <DetailRow label="Anchor Contract" value={trail.chain.anchorContract} copyable />
                            )}
                            {trail?.chain?.anchorChainId && (
                                <DetailRow label="0G Chain ID" value={String(trail.chain.anchorChainId)} />
                            )}
                        </dl>
                    </motion.div>

                    {/* Footer */}
                    <div className="mt-8 text-center">
                        <p className="text-[11px] text-gray-400 font-medium">
                            Powered by <span className="font-bold text-[#0A1628]">Coal</span> x <span className="font-bold text-[#0A1628]">0G</span>
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
