'use client';

import { useEffect, useState } from 'react';
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
            <div className={`pb-8 ${isLast ? 'pb-0' : ''}`}>
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-black text-[#0A1628]">{title}</h3>
                    <StepBadge status={status} />
                </div>
                <p className="text-xs text-gray-500 font-medium mb-2">{description}</p>
                {hash && (
                    <p className="text-[11px] font-mono text-gray-400 break-all mb-1.5">
                        {hash}
                    </p>
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

export default function ReceiptVerifyPage() {
    const params = useParams();
    const id = params.id as string;
    const [receipt, setReceipt] = useState<ReceiptData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!id) return;
        // H6: Validate ID format and encode to prevent path traversal
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
                <div className="animate-pulse text-gray-400 font-bold">Loading receipt...</div>
            </div>
        );
    }

    if (error || !receipt) {
        return (
            <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-black text-[#0A1628] mb-2">Receipt not found</h1>
                    <p className="text-gray-500 font-medium">
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
                    <h1 className="text-2xl font-black text-[#0A1628] mb-2">Payment Pending</h1>
                    <p className="text-gray-500 font-medium">
                        Status: {receipt.status}. This payment has not been confirmed yet.
                    </p>
                </div>
            </div>
        );
    }

    const trail = receipt.proofTrail;

    return (
        <div className="min-h-screen bg-[#FAFAF8]">
            <div className="mx-auto max-w-2xl px-4 py-16">
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
                        <p className="text-gray-500 font-medium">
                            {receipt.payment.amount} {receipt.payment.currency}
                            {receipt.merchant?.name ? ` to ${receipt.merchant.name}` : ''}
                        </p>
                        {receipt.payment.description && (
                            <p className="text-sm text-gray-400 mt-1">{receipt.payment.description}</p>
                        )}
                    </div>

                    {/* Proof Trail */}
                    <div className="rounded-[32px] border-2 border-black/5 bg-white p-8">
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
                    </div>

                    {/* Technical Details */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="mt-6 rounded-[24px] border-2 border-black/5 bg-white p-6"
                    >
                        <h3 className="text-xs font-black text-[#0A1628] mb-3 uppercase tracking-wider">
                            Verification Details
                        </h3>
                        <dl className="space-y-2 text-xs">
                            <div className="flex justify-between">
                                <dt className="font-bold text-gray-500">Checkout ID</dt>
                                <dd className="font-mono text-gray-700">{receipt.checkoutId}</dd>
                            </div>
                            {trail?.storage?.storageRoot && (
                                <div className="flex justify-between">
                                    <dt className="font-bold text-gray-500">Storage Root</dt>
                                    <dd className="font-mono text-gray-700 truncate max-w-[300px]">
                                        {trail.storage.storageRoot}
                                    </dd>
                                </div>
                            )}
                            {trail?.chain?.anchorContract && (
                                <div className="flex justify-between">
                                    <dt className="font-bold text-gray-500">Anchor Contract</dt>
                                    <dd className="font-mono text-gray-700 truncate max-w-[300px]">
                                        {trail.chain.anchorContract}
                                    </dd>
                                </div>
                            )}
                            {trail?.chain?.anchorChainId && (
                                <div className="flex justify-between">
                                    <dt className="font-bold text-gray-500">0G Chain ID</dt>
                                    <dd className="font-mono text-gray-700">{trail.chain.anchorChainId}</dd>
                                </div>
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
