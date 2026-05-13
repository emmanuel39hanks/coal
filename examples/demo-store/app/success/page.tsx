
import Link from 'next/link';

const COAL_API_URL = process.env.COAL_API_URL || 'https://api.usecoal.xyz';

interface ReceiptShape {
    status?: string;
    verified?: boolean;
    checkoutId?: string;
    metadata?: Record<string, unknown>;
    payment?: { amount?: string; currency?: string; txHash?: string };
    proofTrail?: {
        storage?: { storageRoot?: string } | null;
        chain?: { anchorTxHash?: string } | null;
    } | null;
}

async function fetchReceipt(sessionId: string): Promise<ReceiptShape | null> {
    try {
        const res = await fetch(`${COAL_API_URL}/api/receipts/${encodeURIComponent(sessionId)}`, {
            headers: { accept: 'application/json' },
            cache: 'no-store',
        });
        if (!res.ok) return null;
        return (await res.json()) as ReceiptShape;
    } catch {
        return null;
    }
}

// Simple inference of which downloadable product the session bought.
// We look at the metadata and the dollar amount as a fallback. As more
// digital goods get added, replace this with an explicit `metadata.product`
// field set at checkout-creation time.
function inferDownloadable(receipt: ReceiptShape | null): { product: string; label: string } | null {
    if (!receipt) return null;
    const meta = (receipt.metadata || {}) as Record<string, unknown>;
    if (typeof meta.product === 'string') {
        if (meta.product === 'ds_0g_cheatsheet' || meta.product === '0g-cheatsheet') {
            return { product: '0g-cheatsheet', label: "The 0G Builder's Cheatsheet" };
        }
    }
    const amount = parseFloat(receipt.payment?.amount || '0');
    if (Math.abs(amount - 0.10) < 0.001) {
        return { product: '0g-cheatsheet', label: "The 0G Builder's Cheatsheet" };
    }
    return null;
}

export default async function SuccessPage({
    searchParams,
}: {
    searchParams: Promise<{ session_id?: string }>;
}) {
    const { session_id: sessionId } = await searchParams;
    const receipt = sessionId ? await fetchReceipt(sessionId) : null;
    const dl = inferDownloadable(receipt);
    const isConfirmed = receipt?.verified === true && receipt?.status === 'confirmed';
    const txHash = receipt?.payment?.txHash;

    return (
        <div className="min-h-screen bg-white flex items-center justify-center p-6">
            <div className="max-w-md w-full text-center">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8 text-6xl">
                    🎉
                </div>
                <h1 className="text-4xl font-black mb-4 tracking-tight">Order Confirmed</h1>
                <p className="text-gray-500 mb-8 text-lg">
                    {dl
                        ? `Your purchase of "${dl.label}" is unlocked. Download it now — link works for 30 days.`
                        : 'Thank you for your purchase. Receipt is anchored on 0G.'}
                </p>

                {dl && sessionId && (
                    // Direct link with session_id triggers a server-side 302 to a
                    // 10-min signed token URL. The token is one-time-window short
                    // and can't be replayed past expiry.
                    <a
                        href={`/api/download/${dl.product}?session_id=${encodeURIComponent(sessionId)}`}
                        className="block w-full mb-4 bg-[#FF5C16] text-white h-14 rounded-full font-bold hover:scale-105 transition-transform flex items-center justify-center gap-2"
                    >
                        Download {dl.label}
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M8 1V11M8 11L4 7M8 11L12 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M2 13H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </a>
                )}

                {!dl && sessionId && (
                    <div className="bg-gray-50 p-6 rounded-2xl mb-8 text-left border border-gray-100">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Session</p>
                        <p className="font-mono text-xs text-gray-600 break-all">{sessionId}</p>
                    </div>
                )}

                {isConfirmed && txHash && (
                    <div className="bg-gray-50 p-4 rounded-2xl mb-4 text-left border border-gray-100 text-xs">
                        <div className="flex justify-between mb-1">
                            <span className="text-gray-400 font-bold uppercase tracking-wider">Tx</span>
                            <a
                                href={`https://basescan.org/tx/${txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-[#FF5C16] truncate ml-2"
                            >
                                {txHash.slice(0, 10)}...{txHash.slice(-8)}
                            </a>
                        </div>
                        {receipt?.proofTrail?.storage?.storageRoot && (
                            <div className="flex justify-between mb-1">
                                <span className="text-gray-400 font-bold uppercase tracking-wider">0G Storage</span>
                                <span className="font-mono text-gray-600 truncate ml-2">
                                    {receipt.proofTrail.storage.storageRoot.slice(0, 10)}...
                                </span>
                            </div>
                        )}
                        {receipt?.proofTrail?.chain?.anchorTxHash && (
                            <div className="flex justify-between">
                                <span className="text-gray-400 font-bold uppercase tracking-wider">0G Anchor</span>
                                <span className="font-mono text-gray-600 truncate ml-2">
                                    {receipt.proofTrail.chain.anchorTxHash.slice(0, 10)}...
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {sessionId && (
                    <a
                        href={`${process.env.NEXT_PUBLIC_COAL_URL || 'https://www.usecoal.xyz'}/verify/${sessionId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full mb-4 bg-gray-100 text-gray-800 h-14 rounded-full font-bold hover:scale-105 transition-transform flex items-center justify-center gap-2"
                    >
                        Verify on Coal
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M5 11L11 5M11 5H6M11 5V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </a>
                )}

                <Link href="/">
                    <button className="w-full bg-black text-white h-14 rounded-full font-bold hover:scale-105 transition-transform">
                        Back to Shop
                    </button>
                </Link>
            </div>
        </div>
    );
}
