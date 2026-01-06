
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Wallet, TickCircle, Copy, Verify, Money } from 'iconsax-reactjs';
import { useModal } from "connectkit";
import { useConnection, useWriteContract } from "wagmi";
import { parseUnits } from "viem";

// MNEE ERC-20 Contract on Ethereum Mainnet
const MNEE_CONTRACT_ADDRESS = '0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF' as const;
const MNEE_DECIMALS = 18; // MNEE ERC-20 uses 18 decimals on Ethereum (standard ERC-20)

// Minimal ERC-20 ABI for transfer
const ERC20_ABI = [
    {
        name: 'transfer',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool' }]
    }
] as const;

interface PaymentData {
    merchant: {
        name: string | null;
        image: string | null;
        payoutAddress: string | null;
    };
    product?: {
        name: string;
        price: string;
        image: string | null;
        description: string | null;
    } | null;
    id?: string;
    title?: string | null;
    description?: string | null;
    amount?: string;
    currency?: string;
}

export default function PaymentView({ data, type }: { data: PaymentData, type: 'link' | 'session' }) {
    const [status, setStatus] = useState<'idle' | 'connecting' | 'processing' | 'success'>('idle');
    const { setOpen } = useModal();
    const { address, isConnected, connector } = useConnection();
    const { writeContractAsync } = useWriteContract();

    // Derived values
    const amount = data.product ? data.product.price : (data.amount || '0.00');
    const currency = data.currency || 'MNEE';
    const isDonation = !data.product && !data.amount;
    const [customAmount, setCustomAmount] = useState('');

    const handlePay = async () => {
        try {
            // If already connected, proceed directly to payment
            if (isConnected && connector) {
                setStatus('processing');
                await processPayment();
                return;
            }

            // Otherwise, open wallet modal
            setOpen(true);
            setStatus('connecting');

        } catch (e) {
            console.error("Connection failed", e);
            setStatus('idle');
        }
    };

    // Watch for connection to proceed (only when modal connects us)
    useEffect(() => {
        if (isConnected && connector && status === 'connecting') {
            // Small delay to let connector fully initialize
            const timer = setTimeout(() => {
                processPayment();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [isConnected, connector, status]);

    // Reset status when disconnected
    useEffect(() => {
        if (!isConnected && status === 'connecting') {
            setStatus('idle');
        }
    }, [isConnected, status]);

    const processPayment = async () => {
        setStatus('processing');
        try {
            let currentSessionId: string | undefined;

            // 1. Create Session if Link
            if (type === 'link') {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/pay/session`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        linkId: data.id,
                        amount: isDonation ? customAmount : undefined
                    })
                });

                if (!res.ok) throw new Error("Failed to create session");
                const json = await res.json();
                currentSessionId = json.sessionId;
            } else {
                currentSessionId = (data as any).id;
            }

            // 2. Send MNEE ERC-20 Token Transfer
            const targetAddress = data.merchant.payoutAddress as `0x${string}`;
            if (!targetAddress) throw new Error("No payout address available");

            const finalAmount = isDonation ? customAmount : amount;
            const amountInAtomicUnits = parseUnits(finalAmount, MNEE_DECIMALS);

            // This triggers the wallet popup for ERC-20 transfer
            const hash = await writeContractAsync({
                address: MNEE_CONTRACT_ADDRESS,
                abi: ERC20_ABI,
                functionName: 'transfer',
                args: [targetAddress, amountInAtomicUnits],
            });

            // 3. Confirm with Backend (Real RPC Verification)
            const confirmRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/pay/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: currentSessionId,
                    txHash: hash
                })
            });

            if (confirmRes.ok) {
                const json = await confirmRes.json();
                setStatus('success');

                // Redirect only if explicit URL exists
                if (json.redirectUrl) {
                    setTimeout(() => {
                        window.location.href = json.redirectUrl;
                    }, 2000);
                }
            } else {
                const errorJson = await confirmRes.json();
                throw new Error(errorJson.error || "Payment verification failed");
            }

        } catch (e) {
            console.error("Payment Process Failed", e);
            setStatus('idle');
            alert("Payment failed: " + (e as Error).message);
        }
    };

    if (status === 'success') {
        return (
            <div className="min-h-screen bg-[#F8F9FA] relative overflow-hidden flex items-center justify-center p-4">
                {/* Background Blobs */}
                <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-[var(--color-brand-orange)]/20 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-pulse z-0" />
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[var(--color-brand-blue)]/15 rounded-full blur-[100px] translate-x-1/3 translate-y-1/3 pointer-events-none z-0" />

                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    className="bg-white p-12 rounded-[40px] text-center max-w-md w-full border-2 border-black shadow-[8px_8px_0px_0px_#27AE60] relative z-10"
                >
                    <div className="w-24 h-24 bg-white border-2 border-black shadow-[4px_4px_0px_0px_#27AE60] rounded-full flex items-center justify-center mx-auto mb-8 text-[#27AE60]">
                        <TickCircle size={48} variant="Bold" />
                    </div>
                    <h2 className="text-4xl font-black text-[var(--color-brand-navy)] mb-4 tracking-tight">Payment Sent!</h2>
                    <p className="text-[var(--color-text-secondary)] font-medium mb-10 text-lg">Thank you for your payment.</p>

                    {/* Conditionally show redirect message or just Done button */}
                    <div className="bg-gray-50 p-6 rounded-2xl border-2 border-black/5 flex flex-col items-center gap-4">
                        <div className="flex items-center gap-2 text-[#27AE60] font-bold">
                            <Verify size={20} variant="Bold" />
                            <span>Transaction Verified</span>
                        </div>
                        <p className="text-sm text-gray-400">You can close this window now.</p>
                    </div>
                </motion.div>
            </div>
        );
    }

    return (

        <div className="min-h-screen bg-[#F8F9FA] relative overflow-hidden flex flex-col md:flex-row">
            {/* Animated Background Blobs (Mobile: Top, Desktop: Left) */}
            <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-[var(--color-brand-orange)]/20 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-pulse z-0" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[var(--color-brand-blue)]/15 rounded-full blur-[100px] translate-x-1/3 translate-y-1/3 pointer-events-none z-0" />

            {/* Left: Product/Merchant Details */}
            <div className="flex-1 p-8 md:p-20 flex flex-col justify-center relative z-10">
                <div className="max-w-xl mx-auto w-full">
                    {/* Merchant Header */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="flex items-center gap-4 mb-12 bg-white/60 backdrop-blur-md p-3 pr-6 rounded-full w-fit border border-white/50 shadow-xs"
                    >
                        {data.merchant.image ? (
                            <Image src={data.merchant.image} alt="Merchant" width={48} height={48} className="rounded-full border-2 border-white shadow-md" />
                        ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-400 border-2 border-white shadow-md">
                                {data.merchant.name?.charAt(0) || 'M'}
                            </div>
                        )}
                        <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-0.5">Pay to</p>
                            <h3 className="font-bold text-[var(--color-brand-navy)] flex items-center gap-1.5 text-lg leading-none">
                                {data.merchant.name || 'Merchant'}
                                <Verify size={18} variant="Bold" className="text-blue-500" />
                            </h3>
                        </div>
                    </motion.div>

                    {/* Product Hero */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        {data.product ? (
                            <div className="mb-10">
                                <div className="aspect-video relative rounded-[32px] overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,0.05)] border-2 border-black/5 mb-8 bg-white group hover:scale-[1.02] transition-transform duration-500">
                                    {data.product.image ? (
                                        <Image src={data.product.image} alt={data.product.name} fill className="object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center text-6xl">
                                            📦
                                        </div>
                                    )}
                                </div>
                                <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-[var(--color-brand-navy)] mb-6 leading-tight">{data.product.name}</h1>
                                <p className="text-xl text-[var(--color-text-secondary)] font-medium leading-relaxed">{data.product.description || "One-time payment"}</p>
                            </div>
                        ) : (
                            <div className="mb-10">
                                {data.title ? (
                                    <div className="mb-6">
                                        <div className="w-24 h-24 bg-white rounded-[32px] flex items-center justify-center text-[var(--color-brand-orange)] mb-8 shadow-[4px_4px_0px_0px_#FF5C16] border-2 border-[var(--color-brand-navy)] rotate-[-3deg] hover:rotate-[3deg] transition-transform duration-300">
                                            <Money size={48} variant="Bold" />
                                        </div>
                                        <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-[var(--color-brand-navy)] mb-6 leading-tight">{data.title}</h1>
                                        <p className="text-xl text-[var(--color-text-secondary)] font-medium leading-relaxed">{data.description || "Complete your payment securely on the MNEE network."}</p>
                                    </div>
                                ) : (
                                    <>
                                        <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-[var(--color-brand-navy)] mb-6 leading-tight">
                                            {isDonation ? "Send Money" : "Payment Request"}
                                        </h1>
                                        <p className="text-xl text-[var(--color-text-secondary)] font-medium leading-relaxed">
                                            Complete your payment securely on the MNEE network.
                                        </p>
                                    </>
                                )}
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>

            {/* Right: Payment Action */}
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="w-full md:w-[500px] bg-white border-l-2 border-black/5 p-8 md:p-12 flex flex-col justify-center shadow-[-20px_0px_40px_rgba(0,0,0,0.02)] z-20 relative"
            >
                <div className="max-w-sm mx-auto w-full">
                    <div className="mb-12">
                        <p className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wide">Amount Due</p>
                        {isDonation ? (
                            <div className="relative group">
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-4xl font-black text-gray-300 group-focus-within:text-[var(--color-brand-orange)] transition-colors">$</span>
                                <input
                                    type="text"
                                    placeholder="0.00"
                                    value={customAmount}
                                    onChange={(e) => setCustomAmount(e.target.value)}
                                    className="w-full text-6xl font-black text-[var(--color-brand-navy)] bg-transparent border-b-2 border-gray-100 py-2 pl-10 focus:border-[var(--color-brand-orange)] focus:outline-none placeholder:text-gray-200 transition-all font-mono tracking-tight"
                                />
                            </div>
                        ) : (
                            <div className="text-6xl font-black text-[var(--color-brand-navy)] flex items-baseline gap-2 tracking-tighter">
                                <span>{parseFloat(amount).toFixed(2)}</span>
                                <span className="text-2xl text-gray-400 font-bold">{currency}</span>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handlePay}
                        disabled={status !== 'idle' || (isDonation && (!customAmount || parseFloat(customAmount) <= 0))}
                        className="w-full h-16 bg-black text-white rounded-full font-bold text-lg hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none flex items-center justify-center gap-3 border-2 border-black"
                    >
                        {status === 'idle' && (
                            <>
                                <Wallet variant="Bold" />
                                {isConnected ? 'Pay with MNEE' : 'Connect Wallet & Pay'}
                            </>
                        )}
                        {status === 'connecting' && "Connecting Wallet..."}
                        {status === 'processing' && "Confirm in Wallet..."}
                    </button>

                    <div className="mt-12 pt-8 border-t-2 border-dashed border-gray-100 flex flex-col items-center justify-center gap-6">
                        <div className="flex flex-col items-center gap-4">
                            <span className="text-gray-400 font-bold text-xs uppercase tracking-wider">Powered by</span>
                            <div className="flex items-center gap-5">
                                <Image src="/logo.png" alt="Coal" width={66} height={66} className="object-contain" />
                                <span className="text-gray-300 text-xl font-light">&</span>
                                <Image src="/mnee.svg" alt="MNEE" width={34} height={20} className="object-contain" />
                            </div>
                        </div>
                        <p className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em]">Powering Programmable Money</p>
                    </div>
                </div>
            </motion.div >
        </div >
    );
}


