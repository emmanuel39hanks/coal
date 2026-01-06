'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ConnectKitButton } from 'connectkit';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import Image from 'next/image';

// MNEE ERC-20 Contract Address
const MNEE_CONTRACT_ADDRESS = '0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF';

// Standard ERC-20 Transfer ABI
const erc20Abi = [
    {
        "constant": false,
        "inputs": [
            { "name": "_to", "type": "address" },
            { "name": "_value", "type": "uint256" }
        ],
        "name": "transfer",
        "outputs": [{ "name": "", "type": "bool" }],
        "type": "function"
    }
];

interface PaymentDetails {
    to: string;
    amount: number;
    token: string;
    productId: string;
    description: string;
}

export default function PayPage() {
    const { isConnected } = useAccount();
    const { data: hash, writeContract, isPending, error: writeError } = useWriteContract();
    const { isLoading: isConfirming, isSuccess: isConfirmed, error: receiptError } =
        useWaitForTransactionReceipt({ hash });

    const [details, setDetails] = useState<PaymentDetails | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(true);

    // Call Backend Verification when tx is confirmed on-chain
    useEffect(() => {
        if (isConfirmed && hash) {
            // Fire and forget verification for MVP feedback
            fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/checkout/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ txHash: hash })
            }).catch(err => console.error("Verification failed", err));
        }
    }, [isConfirmed, hash]);

    // Fetch checkout details on mount
    useEffect(() => {
        async function fetchDetails() {
            try {
                // In production this comes from the URL param or state
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/checkout/init`, {
                    method: 'POST',
                    body: JSON.stringify({ productId: 'prod_123' })
                });

                if (res.ok) {
                    const data = await res.json();
                    setDetails(data);
                } else {
                    // Fallback Mock if backend offline
                    setDetails({
                        to: "0xfD6dC00c77C80E46aa01acF440b87baB8FdB772a", // User's Preferred Address
                        amount: 0.01,
                        token: "MNEE",
                        productId: "prod_123",
                        description: "Limited Edition Tee"
                    });
                }
            } catch (e) {
                // Fallback Mock
                setDetails({
                    to: "0xfD6dC00c77C80E46aa01acF440b87baB8FdB772a", // User's Preferred Address
                    amount: 0.01,
                    token: "MNEE",
                    productId: "prod_123",
                    description: "Limited Edition Tee"
                });
            } finally {
                setLoadingDetails(false);
            }
        }
        fetchDetails();
    }, []);

    const handlePay = async () => {
        if (!details) return;

        writeContract({
            address: MNEE_CONTRACT_ADDRESS,
            abi: erc20Abi,
            functionName: 'transfer',
            args: [details.to, parseUnits(details.amount.toString(), 6)],
        });
    };

    if (loadingDetails) {
        return (
            <div className="min-h-screen bg-[#F5F2ED] flex items-center justify-center">
                <div className="animate-pulse w-12 h-12 bg-gray-200 rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F5F2ED] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white w-full max-w-md rounded-[32px] border border-gray-100 p-8 shadow-[0px_8px_40px_rgba(0,0,0,0.08)]"
            >
                {/* Header / Brand */}
                <div className="text-center mb-8">
                    <div className="mx-auto w-32 h-32 relative">
                        <Image
                            src="/logo.png"
                            alt="Coal Logo"
                            fill
                            className="object-contain"
                        />
                    </div>
                    <div className="inline-block px-3 py-1 bg-gray-100 rounded-full text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
                        Checkout
                    </div>
                </div>

                {/* Error Handling UI */}
                {(writeError || receiptError) && (
                    <div className="mb-6 p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 text-center">
                        <strong>
                            {(writeError?.message.includes('User rejected') || writeError?.message.includes('User denied'))
                                ? 'Payment cancelled'
                                : (writeError?.message.includes('Insufficient funds') || writeError?.message.includes('exceeds balance'))
                                    ? 'Insufficient funds for gas'
                                    : 'Something went wrong'}
                        </strong>
                        <p className="text-xs mt-1 text-red-400">
                            {(writeError?.message.includes('User rejected') || writeError?.message.includes('User denied'))
                                ? 'You rejected the transaction in your wallet.'
                                : (writeError?.message.includes('Insufficient funds') || writeError?.message.includes('exceeds balance'))
                                    ? 'You need a small amount of ETH to pay for network fees.'
                                    : 'Please try again or check console for details.'}
                        </p>
                    </div>
                )}

                {isConfirmed ? (
                    <div className="text-center space-y-6">
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto text-green-500"
                        >
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                        </motion.div>
                        <div>
                            <h2 className="text-2xl font-bold text-[var(--color-brand-navy)] mb-2">Payment Sent!</h2>
                            <p className="text-gray-500 text-sm">Your MNEE transfer is on its way.</p>
                        </div>
                        <a
                            href={`https://etherscan.io/tx/${hash}`}
                            target="_blank"
                            className="block w-full py-4 text-center rounded-2xl bg-gray-50 text-[var(--color-brand-navy)] font-bold text-sm hover:bg-gray-100 transition-colors"
                        >
                            View Receipt
                        </a>
                    </div>
                ) : (
                    <>
                        {/* Product Details Card */}
                        <div className="bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-100 relative overflow-hidden">
                            {/* Accents */}
                            <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--color-brand-orange)] opacity-[0.03] rounded-full -mr-8 -mt-8 pointer-events-none"></div>

                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h3 className="text-lg font-bold text-[var(--color-brand-navy)]">{details?.description}</h3>
                                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">One-time payment</p>
                                </div>
                            </div>

                            <div className="mt-6 flex items-baseline gap-1">
                                <span className="text-4xl font-black text-[var(--color-brand-navy)]">{details?.amount}</span>
                                <span className="text-lg font-bold text-[var(--color-brand-orange)]">MNEE</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-4">
                            <div className="flex justify-center">
                                <ConnectKitButton />
                            </div>

                            {isConnected && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                >
                                    <button
                                        onClick={handlePay}
                                        disabled={isPending || isConfirming}
                                        className={`w-full py-4 rounded-xl font-bold text-lg shadow-[0px_4px_0px_0px_#180D43] transition-all relative top-0 hover:-top-1 hover:shadow-[0px_6px_0px_0px_#180D43] active:top-0 active:shadow-none
                                            ${(isPending || isConfirming)
                                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none !top-0'
                                                : 'bg-[var(--color-brand-orange)] text-white'
                                            }`}
                                    >
                                        {isPending ? 'Confirming...' : isConfirming ? 'Processing...' : `Pay ${details?.amount} MNEE`}
                                    </button>

                                    <p className="text-center text-[10px] text-gray-400 mt-4 leading-relaxed max-w-[200px] mx-auto">
                                        Secure payment powered by <strong>Coal</strong> & <strong>MNEE</strong>.
                                    </p>
                                </motion.div>
                            )}
                        </div>
                    </>
                )}
            </motion.div>
        </div>
    );
}
