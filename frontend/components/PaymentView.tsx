'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Wallet, TickCircle, Copy, Verify, Money } from 'iconsax-reactjs';
import { useAuth as usePrivy, useAuthWallets as useWallets, useCreateEmbeddedWallet } from '@/lib/auth';
import { parseUnits, encodeFunctionData } from 'viem';
import FiatOnramp from './FiatOnramp';
import Spinner from './Spinner';
import { useToast } from './Toast';
import { getSettlementToken, EXPLORER_URL } from '@/lib/chain';
import TokenSelector from './TokenSelector';
import {
    ETH_BASE,
    executeSettlementRoute,
    getLifiQuote,
    getSettlementExecutionQuote,
    SETTLEMENT_TOKEN_OPTION,
    TOKEN_OPTIONS,
    USDC_BASE,
    type TokenOption,
} from '@/lib/lifi';
import { formatAmount, parseAmountInput } from '@/lib/utils';
import { getApiBaseUrl } from '@/lib/api-base';
import {
    PAYER_INFO_FIELD_META,
    type PayerInfoField,
    type PayerInfoValues,
    normalizePayerInfoConfig,
    normalizePayerInfoValues,
    validatePayerInfo,
} from '@/lib/payer-info';

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
    expired?: boolean;
    merchant?: {
        name: string | null;
        image: string | null;
        payoutAddress: string | null;
    };
    product?: {
        name: string;
        price: string;
        image: string | null;
        description: string | null;
        billingType?: 'one_time' | 'subscription';
        billingInterval?: string | null;
        billingIntervalCount?: number | null;
    } | null;
    id?: string;
    title?: string | null;
    description?: string | null;
    amount?: string;
    currency?: string;
    billingReason?: string;
    customerEmail?: string | null;
    customerAddress?: string | null;
    payerInfoConfig?: { required?: boolean; fields?: string[] } | null;
    payerInfo?: Record<string, unknown> | null;
}

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS  = 2 * 60 * 1000; // 2 minutes

type PaymentViewMode = 'standalone' | 'embed';
type FundingStatus = 'idle' | 'submitted' | 'processing' | 'funded' | 'route_executing' | 'settlement_submitted' | 'settled' | 'failed';

type FundingIntentSnapshot = {
    id: string;
    walletType: 'embedded' | 'external';
    fundingAsset: string;
    targetSettlementAsset: string | null;
    gasReserve: string | null;
    routeEstimate: Record<string, unknown> | null;
    resumeState: string | null;
};

export default function PaymentView({
    data,
    type,
    mode = 'standalone',
}: {
    data: PaymentData,
    type: 'link' | 'session',
    mode?: PaymentViewMode,
}) {
    const [status, setStatus] = useState<'idle' | 'connecting' | 'processing' | 'verifying' | 'success' | 'failed'>('idle');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [pendingTxHash, setPendingTxHash] = useState<string | null>(null);
    const [checkoutSessionId, setCheckoutSessionId] = useState<string | null>(data.id ?? null);
    const [fundingIntentId, setFundingIntentId] = useState<string | null>(null);
    const [fundingStatus, setFundingStatus] = useState<FundingStatus>('idle');
    const [fundingMessage, setFundingMessage] = useState<string | null>(null);
    const [fundingIntent, setFundingIntent] = useState<FundingIntentSnapshot | null>(null);
    const [autoResumingCardSettlement, setAutoResumingCardSettlement] = useState(false);
    const [autoResumeFundingIntentId, setAutoResumeFundingIntentId] = useState<string | null>(null);
    const [recurringConsentAccepted, setRecurringConsentAccepted] = useState(false);
    const payerInfoConfig = normalizePayerInfoConfig(data.payerInfoConfig);
    const [payerInfo, setPayerInfo] = useState(() => ({
        ...normalizePayerInfoValues(data.payerInfo),
        ...(payerInfoConfig?.fields.includes('email') && data.customerEmail
            ? { email: data.customerEmail }
            : {}),
    }));
    const [payerInfoErrors, setPayerInfoErrors] = useState<Partial<Record<PayerInfoField, string>>>({});
    const apiBaseUrl = getApiBaseUrl();
    const searchParams = useSearchParams();
    const toast = useToast();
    const { login, authenticated, getAccessToken, connectWallet } = usePrivy();
    const { wallets } = useWallets();
    const { createWallet } = useCreateEmbeddedWallet();
    const embeddedWallet = wallets.find((wallet) => wallet.walletClientType === 'privy') ?? null;
    const externalWallet = wallets.find((wallet) => wallet.walletClientType !== 'privy') ?? null;
    const activeWallet = externalWallet ?? embeddedWallet ?? wallets[0];
    const fundingWallet = embeddedWallet;
    // For settlement, always prefer external wallet (MetaMask etc) — embedded is for card funding only
    const settlementWallet =
        fundingIntent?.walletType === 'embedded'
            ? embeddedWallet ?? activeWallet
            : externalWallet ?? activeWallet;
    const address = activeWallet?.address;
    const settlementAddress = settlementWallet?.address;
    const isConnected = wallets.length > 0 && (authenticated || externalWallet !== null);

    // Expired session — show before any hooks that depend on data.merchant
    if (data.expired) {
        return (
            <div className="min-h-screen bg-[#F8F9FA] relative overflow-hidden flex items-center justify-center p-4">
                <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-[var(--color-brand-orange)]/10 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0" />
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    className="bg-white p-12 rounded-[40px] text-center max-w-md w-full border-2 border-black shadow-[8px_8px_0px_0px_#E5E7EB] relative z-10"
                >
                    <div className="w-24 h-24 bg-gray-50 border-2 border-black/10 rounded-full flex items-center justify-center mx-auto mb-8 text-4xl">
                        ⏰
                    </div>
                    <h2 className="text-4xl font-black text-[var(--color-brand-navy)] mb-4 tracking-tight">Session Expired</h2>
                    <p className="text-[var(--color-text-secondary)] font-medium text-lg">This payment session has expired. Please return to the merchant and start a new checkout.</p>
                </motion.div>
            </div>
        );
    }

    // At this point expired is false, so merchant is always present
    const merchant = data.merchant!;

    // Derived values
    const amount = data.product ? data.product.price : (data.amount || '0.00');
    const currency = data.currency || getSettlementToken().symbol;
    const isRecurringProduct = data.product?.billingType === 'subscription';
    const isRecurringRenewalCheckout =
        isRecurringProduct &&
        data.billingReason !== 'subscription_initial' &&
        data.billingReason !== 'initial';
    const isDonation = !data.product && !data.amount;
    const [customAmount, setCustomAmount] = useState('');
    const sessionId = checkoutSessionId;
    const parsedAmount = parseAmountInput(amount) ?? 0;
    const parsedCustomAmount = parseAmountInput(customAmount);
    const amountForQuote = isDonation ? (parsedCustomAmount ?? 0) : parsedAmount;

    // LiFi multi-token state
    const [selectedToken, setSelectedToken] = useState<TokenOption>(TOKEN_OPTIONS[0]);
    const [lifiQuote, setLifiQuote] = useState<{ fromAmount: string; estimatedTime: number; fees: string } | null>(null);
    const [quoteLoading, setQuoteLoading] = useState(false);
    const canRequestRouteQuote = Boolean(address && merchant.payoutAddress);
    const routeQuoteHint = !isConnected
        ? 'Connect a wallet to preview routed amounts.'
        : !merchant.payoutAddress
            ? 'Merchant settlement details are still loading.'
            : null;
    const isDirectSettlementToken =
        selectedToken.address.toLowerCase() === USDC_BASE.address.toLowerCase() &&
        selectedToken.chainId === USDC_BASE.chainId;
    const isRoutePreviewSelection = !isDirectSettlementToken;
    const cardPaymentsStatus = (process.env.NEXT_PUBLIC_CARD_PAYMENTS_STATUS || 'coming_soon').toLowerCase();
    const cardPaymentsComingSoon = cardPaymentsStatus !== 'live';
    const canUseFiatOnramp =
        cardPaymentsStatus === 'live' &&
        Boolean(process.env.NEXT_PUBLIC_MOONPAY_API_KEY);
    const showCardPaymentsCta =
        !isRecurringRenewalCheckout &&
        (cardPaymentsComingSoon || Boolean(process.env.NEXT_PUBLIC_MOONPAY_API_KEY));
    const recurringLabel = isRecurringProduct
        ? `Every ${data.product?.billingIntervalCount && data.product.billingIntervalCount > 1 ? `${data.product.billingIntervalCount} ` : ''}${data.product?.billingInterval || 'month'}${data.product?.billingIntervalCount && data.product.billingIntervalCount > 1 ? 's' : ''}`
        : null;
    const hasPayerInfoFields = Boolean(payerInfoConfig?.fields.length);
    const payerInfoPayload: PayerInfoValues = hasPayerInfoFields
        ? normalizePayerInfoValues(
            Object.fromEntries(
                (payerInfoConfig?.fields || []).map((field) => [field, payerInfo[field] || '']),
            ),
        )
        : {};
    const payerInfoValidationErrors = validatePayerInfo(payerInfoConfig, payerInfoPayload);
    const payerInfoValid = Object.keys(payerInfoValidationErrors).length === 0;
    const cardFlowBlocked =
        status !== 'idle' ||
        (isDonation && (!customAmount || (parsedCustomAmount ?? 0) <= 0)) ||
        (hasPayerInfoFields && !payerInfoValid) ||
        (isRecurringProduct && !recurringConsentAccepted) ||
        isRoutePreviewSelection;

    // Determine if using embedded wallet (gasless) vs external
    const isEmbeddedWallet = settlementWallet?.walletClientType === 'privy';

    const emitEmbedEvent = (type: string, payload: Record<string, unknown> = {}) => {
        if (mode !== 'embed' || typeof window === 'undefined' || window.parent === window) {
            return;
        }

        window.parent.postMessage(
            {
                type,
                ...(sessionId ? { sessionId } : {}),
                ...payload,
            },
            '*',
        );
    };

    const handleEmbedClose = () => {
        emitEmbedEvent('coal:close');
    };

    useEffect(() => {
        if (mode !== 'embed') return;

        if (data.expired) {
            emitEmbedEvent('coal:error', { message: 'This payment session has expired.' });
            return;
        }

        if (sessionId) {
            emitEmbedEvent('coal:ready');
        }
    }, [mode, data.expired, sessionId]);

    const handlePay = async () => {
        try {
            // If already connected with an external wallet, proceed directly
            if (isConnected && externalWallet) {
                setStatus('processing');
                await processPayment();
                return;
            }

            // Connect external wallet directly (MetaMask, WalletConnect, etc)
            // This skips Privy's full login flow and embedded wallet creation
            connectWallet();
            setStatus('connecting');

        } catch (e) {
            console.error("Connection failed", e);
            setStatus('idle');
        }
    };

    // Watch for external wallet connection to proceed
    useEffect(() => {
        if (externalWallet && status === 'connecting') {
            // Small delay to let wallet fully initialize
            const timer = setTimeout(() => {
                setStatus('processing');
                processPayment();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [externalWallet, status]);

    // Reset status when disconnected
    useEffect(() => {
        if (!isConnected && status === 'connecting') {
            setStatus('idle');
        }
    }, [isConnected, status]);

    useEffect(() => {
        const resumedFundingIntentId = searchParams.get('fundingIntentId');
        if (!resumedFundingIntentId || resumedFundingIntentId === fundingIntentId) {
            return;
        }

        setFundingIntentId(resumedFundingIntentId);
        setFundingStatus('processing');
        setFundingMessage('Checking your card funding status…');
        setAutoResumeFundingIntentId(null);
    }, [fundingIntentId, searchParams]);

    // Fetch LiFi quote when a non-USDC token is selected
    useEffect(() => {
        const isDirectUSDC = isDirectSettlementToken;

        if (isDirectUSDC) {
            setLifiQuote(null);
            setQuoteLoading(false);
            return;
        }

        const finalAmount = amountForQuote;
        if (!finalAmount || finalAmount <= 0 || !address || !merchant.payoutAddress) {
            setLifiQuote(null);
            setQuoteLoading(false);
            return;
        }

        let cancelled = false;
        setQuoteLoading(true);
        setLifiQuote(null);

        getLifiQuote({
            fromToken: selectedToken,
            toAmountUSDC: finalAmount,
            fromAddress: address,
            toAddress: merchant.payoutAddress,
        }).then((q) => {
            if (!cancelled) {
                setLifiQuote(q);
                setQuoteLoading(false);
            }
        });

        return () => { cancelled = true; };
    }, [selectedToken, amountForQuote, address, isDonation, merchant.payoutAddress, parsedAmount, parsedCustomAmount, isDirectSettlementToken]);

    /** Poll /api/pay/status/:sessionId until confirmed, failed, or timeout. */
    const pollStatus = (sessionId: string, submittedTxHash?: string) => {
        setStatus('verifying');
        if (submittedTxHash) setPendingTxHash(submittedTxHash);
        const start = Date.now();

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${apiBaseUrl}/api/pay/status/${sessionId}`);
                if (!res.ok) return; // Network blip — keep polling

                const json = await res.json();

                if (json.status === 'confirmed') {
                    clearInterval(interval);
                    setPendingTxHash(null);
                    setStatus('success');
                    emitEmbedEvent('coal:success', {
                        txHash: json.txHash ?? submittedTxHash ?? null,
                        redirectUrl: json.redirectUrl ?? null,
                    });
                    if (mode !== 'embed' && json.redirectUrl) {
                        setTimeout(() => { window.location.href = json.redirectUrl; }, 2000);
                    }
                    return;
                }

                if (json.status === 'failed' || json.status === 'expired') {
                    clearInterval(interval);
                    const msg = json.status === 'expired'
                        ? 'Session expired.'
                        : 'Payment could not be verified on-chain.';
                    setErrorMsg(msg);
                    toast('error', msg);
                    emitEmbedEvent('coal:error', {
                        txHash: json.txHash ?? submittedTxHash ?? null,
                        message: msg,
                    });
                    setStatus('failed');
                    return;
                }

                // Timeout guard
                if (Date.now() - start > POLL_TIMEOUT_MS) {
                    clearInterval(interval);
                    const msg = 'Verification is taking longer than expected. Your payment may still process.';
                    setErrorMsg(msg);
                    emitEmbedEvent('coal:error', {
                        txHash: submittedTxHash ?? null,
                        message: msg,
                    });
                    setStatus('failed');
                }
            } catch {
                // Network error — keep polling silently
            }
        }, POLL_INTERVAL_MS);

        // Return cleanup so callers can cancel if needed
        return () => clearInterval(interval);
    };

    const validateCheckoutReady = (mode: 'wallet' | 'card') => {
        if (mode === 'card' && isRoutePreviewSelection) {
            const message = `Card funding currently supports direct ${getSettlementToken().symbol} settlement only. Switch back to the direct settlement token before continuing.`;
            setErrorMsg(message);
            toast('error', message);
            return false;
        }

        if (mode === 'wallet' && isRoutePreviewSelection) {
            const message = 'Route previews are available, but live routed checkout execution is not enabled yet. Switch back to direct USDC settlement to complete payment.';
            setErrorMsg(message);
            toast('error', message);
            return false;
        }

        if (isDonation && (!customAmount || (parsedCustomAmount ?? 0) <= 0)) {
            const message = 'Enter an amount before continuing.';
            setErrorMsg(message);
            toast('error', message);
            return false;
        }

        if (hasPayerInfoFields) {
            const nextErrors = validatePayerInfo(payerInfoConfig, payerInfoPayload);
            setPayerInfoErrors(nextErrors);
            if (Object.keys(nextErrors).length > 0) {
                const message = 'Please complete the required payer details before continuing.';
                setErrorMsg(message);
                toast('error', message);
                return false;
            }
        }

        if (isRecurringProduct && !recurringConsentAccepted) {
            const message = 'Approve the recurring billing mandate before continuing.';
            setErrorMsg(message);
            toast('error', message);
            return false;
        }

        return true;
    };

    const ensureCheckoutSession = async () => {
        let currentSessionId = checkoutSessionId;

        if (type === 'link' && !currentSessionId) {
            const res = await fetch(`${apiBaseUrl}/api/pay/session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    linkId: data.id,
                    amount: isDonation ? customAmount : undefined,
                    customerEmail: payerInfoPayload.email || undefined,
                    subscriptionConsentAccepted: isRecurringProduct ? recurringConsentAccepted : undefined,
                    payerInfo: hasPayerInfoFields ? payerInfoPayload : undefined,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.error?.message || 'Failed to create payment session');
            }
            const json = await res.json();
            currentSessionId = json.sessionId;
            setCheckoutSessionId(currentSessionId);
        }

        if (!currentSessionId) {
            throw new Error('Checkout session unavailable');
        }

        if (hasPayerInfoFields) {
            const payerInfoRes = await fetch(`${apiBaseUrl}/api/pay/payer-info`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: currentSessionId,
                    payerInfo: payerInfoPayload,
                }),
            });
            if (!payerInfoRes.ok) {
                const err = await payerInfoRes.json().catch(() => ({}));
                throw new Error(err?.error?.message || 'Failed to save payer info');
            }
        }

        return currentSessionId;
    };

    const createCardFundingIntent = async (walletAddress: string) => {
        try {
            setErrorMsg(null);

            if (!validateCheckoutReady('card')) {
                return null;
            }

            const currentSessionId = await ensureCheckoutSession();
            const accessToken = await getAccessToken().catch(() => null);
            const response = await fetch(`${apiBaseUrl}/api/pay/funding-intents`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
                },
                body: JSON.stringify({
                    sessionId: currentSessionId,
                    walletAddress,
                    fundingMode: fundingWallet?.address?.toLowerCase() === walletAddress.toLowerCase() ? 'embedded' : 'external',
                }),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                const message = err?.error?.message || 'Failed to prepare card checkout';
                setErrorMsg(message);
                toast('error', message);
                return null;
            }

            const json = await response.json();
            setFundingIntentId(json.fundingIntentId);
            setFundingIntent({
                id: json.fundingIntentId as string,
                walletType: (json.walletType as 'embedded' | 'external' | undefined) || 'external',
                fundingAsset: (json.fundingAsset as string | undefined) || ETH_BASE.symbol.toLowerCase(),
                targetSettlementAsset: (json.targetSettlementAsset as string | undefined) ?? null,
                gasReserve: (json.gasReserve as string | undefined) ?? null,
                routeEstimate: (json.routeEstimate as Record<string, unknown> | undefined) ?? null,
                resumeState: (json.resumeState as string | undefined) ?? null,
            });
            setFundingMessage(json.testnetNotice || json.note || null);
            return {
                fundingIntentId: json.fundingIntentId as string,
                url: json.url as string,
                note: (json.note as string | undefined) ?? null,
                testnetNotice: (json.testnetNotice as string | undefined) ?? null,
            };
        } catch (error) {
            const message = (error as Error)?.message || 'Failed to prepare card checkout';
            setErrorMsg(message);
            toast('error', message);
            return null;
        }
    };

    useEffect(() => {
        if (!fundingIntentId || (fundingStatus !== 'submitted' && fundingStatus !== 'processing' && fundingStatus !== 'settlement_submitted')) {
            return;
        }

        let cancelled = false;

        const pollFunding = async () => {
            try {
                const response = await fetch(`${apiBaseUrl}/api/pay/funding-intents/${fundingIntentId}`);
                if (!response.ok) {
                    return;
                }

                const json = await response.json();
                if (cancelled) {
                    return;
                }

                setFundingIntent((current) => ({
                    id: json.id as string,
                    walletType: (json.walletType as 'embedded' | 'external' | undefined) || current?.walletType || 'external',
                    fundingAsset: (json.fundingAsset as string | undefined) || current?.fundingAsset || ETH_BASE.symbol.toLowerCase(),
                    targetSettlementAsset: (json.targetSettlementAsset as string | undefined) ?? current?.targetSettlementAsset ?? null,
                    gasReserve: (json.gasReserve as string | undefined) ?? current?.gasReserve ?? null,
                    routeEstimate: (json.routeEstimate as Record<string, unknown> | undefined) ?? current?.routeEstimate ?? null,
                    resumeState: (json.resumeState as string | undefined) ?? current?.resumeState ?? null,
                }));

                if (json.resumeState === 'settled') {
                    setFundingStatus('settled');
                    setFundingMessage('Card-funded wallet settlement completed.');
                    return;
                }

                if (json.resumeState === 'settlement_submitted') {
                    setFundingStatus('settlement_submitted');
                    setFundingMessage('Onchain settlement submitted. Waiting for Coal to verify the payment.');
                    return;
                }

                if (json.status === 'funded') {
                    setFundingStatus('funded');
                    setFundingMessage(
                        json.testnetNotice ||
                            'Wallet funding confirmed. Coal is ready to complete the merchant payment from this wallet.',
                    );
                    return;
                }

                if (json.status === 'failed' || json.status === 'cancelled') {
                    setFundingStatus('failed');
                    setFundingMessage(
                        json.failureReason ||
                            (json.status === 'cancelled'
                                ? 'Card funding was cancelled before the wallet was funded.'
                                : 'Card funding failed. Please try again or use wallet pay.'),
                    );
                    return;
                }

                setFundingStatus('processing');
                setFundingMessage(
                    json.testnetNotice ||
                        'MoonPay is still processing the card purchase. Once funds arrive in your wallet, complete the onchain payment below.',
                );
            } catch {
                // Keep the last visible state; polling will retry on the next tick.
            }
        };

        void pollFunding();
        const interval = setInterval(() => {
            void pollFunding();
        }, 4000);

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [apiBaseUrl, fundingIntentId, fundingStatus]);

    useEffect(() => {
        if (fundingStatus !== 'funded' || !fundingIntentId) {
            return;
        }

        if (!settlementWallet || !settlementAddress) {
            setFundingMessage('Wallet funded. Sign in to your Coal wallet to finish the onchain payment.');
            return;
        }

        if (autoResumeFundingIntentId === fundingIntentId || autoResumingCardSettlement) {
            return;
        }

        setAutoResumeFundingIntentId(fundingIntentId);
        setAutoResumingCardSettlement(true);

        void processPayment().finally(() => {
            setAutoResumingCardSettlement(false);
        });
    }, [
        autoResumeFundingIntentId,
        autoResumingCardSettlement,
        fundingIntentId,
        fundingStatus,
        settlementAddress,
        settlementWallet,
    ]);

    const submitPaymentConfirmation = async (currentSessionId: string, hash: string, payerWalletAddress?: string | null) => {
        const confirmRes = await fetch(`${apiBaseUrl}/api/pay/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: currentSessionId,
                txHash: hash,
                fundingIntentId: fundingIntentId || undefined,
                payerAddress: payerWalletAddress || undefined,
                customerEmail: payerInfoPayload.email || undefined,
                subscriptionConsentAccepted: isRecurringProduct ? recurringConsentAccepted : undefined,
                payerInfo: hasPayerInfoFields ? payerInfoPayload : undefined,
            }),
        });

        if (!confirmRes.ok) {
            const err = await confirmRes.json().catch(() => ({}));
            throw new Error(err?.error?.message || err?.error || 'Failed to submit transaction');
        }

        setFundingStatus((current) =>
            current === 'route_executing' || current === 'funded' ? 'settlement_submitted' : current,
        );
        setFundingMessage((current) =>
            fundingIntentId
                ? 'Onchain settlement submitted. Waiting for Coal to verify the payment.'
                : current,
        );
    };

    const executeSettlementFromWallet = async (currentSessionId: string) => {
        const currentWallet = settlementWallet;
        const currentAddress = settlementWallet?.address;
        if (!merchant.payoutAddress) {
            throw new Error('No payout address configured for this merchant');
        }
        if (!currentWallet || !currentAddress) {
            throw new Error('No wallet connected');
        }

        const finalAmount = isDonation ? customAmount : amount;
        const settlementToken = getSettlementToken();

        if (fundingIntent?.fundingAsset === ETH_BASE.address || fundingIntent?.fundingAsset === 'eth_base' || fundingIntent?.fundingAsset === 'eth') {
            setFundingStatus('route_executing');
            setFundingMessage(`Funding confirmed. Coal is routing ${ETH_BASE.symbol} into ${settlementToken.symbol} and settling this payment from your Coal wallet.`);

            const quote = await getSettlementExecutionQuote({
                fromAddress: currentAddress,
                toAddress: merchant.payoutAddress,
                settlementAmount: finalAmount,
            });

            const route = await executeSettlementRoute({
                quote,
                wallet: currentWallet,
            });

            const routeProcesses = route.steps.flatMap((step) => step.execution?.process || []);
            const finalHash = [...routeProcesses].reverse().find((process) => process.txHash)?.txHash;

            if (!finalHash) {
                throw new Error('Route executed, but Coal could not determine the settlement transaction hash.');
            }

            await submitPaymentConfirmation(currentSessionId, finalHash, currentAddress);
            pollStatus(currentSessionId, finalHash);
            return;
        }

        const targetAddress = merchant.payoutAddress as `0x${string}`;
        const amountInAtomicUnits = parseUnits(finalAmount, settlementToken.decimals);
        const callData = encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [targetAddress, amountInAtomicUnits],
        });

        const provider = await currentWallet.getEthereumProvider();
        const hash = await provider.request({
            method: 'eth_sendTransaction',
            params: [{
                from: currentAddress,
                to: settlementToken.address,
                data: callData,
            }],
        }) as string;

        await submitPaymentConfirmation(currentSessionId, hash, currentAddress);
        pollStatus(currentSessionId, hash);
    };

    async function processPayment() {
        setStatus('processing');
        setErrorMsg(null);
        try {
            if (!validateCheckoutReady('wallet')) {
                setStatus('idle');
                return;
            }

            const currentSessionId = await ensureCheckoutSession();
            await executeSettlementFromWallet(currentSessionId);

        } catch (e) {
            console.error("Payment failed:", e);
            console.error("Payment debug:", {
                settlementWalletAddress: settlementWallet?.address,
                settlementWalletType: settlementWallet?.walletClientType,
                externalWalletAddress: externalWallet?.address,
                embeddedWalletAddress: embeddedWallet?.address,
                merchantPayoutAddress: merchant?.payoutAddress,
                walletsCount: wallets.length,
                walletTypes: wallets.map(w => `${w.walletClientType}:${w.address?.slice(0,8)}`),
                authenticated,
                isConnected,
            });
            const msg = (e as Error).message || '';
            const friendly =
                msg.includes('rejected') || msg.includes('denied') || msg.includes('cancel') ? 'cancelled' :
                msg.includes('gas required exceeds allowance') || msg.includes('allowance (0)') || msg.includes('gas required') ? 'gas' :
                msg.includes('insufficient funds') || msg.includes('exceeds balance') || msg.includes('insufficient balance') ? 'balance' :
                msg.includes('nonce') ? 'nonce' :
                msg.includes('network') || msg.includes('fetch') || msg.includes('timeout') ? 'network' :
                'unknown';
            const friendlyMsg =
                friendly === 'cancelled' ? 'Transaction cancelled.' :
                friendly === 'gas' ? 'Not enough ETH for gas fees. Fund your Coal wallet with a little more Base ETH and try again.' :
                friendly === 'balance' ? 'Insufficient USDC balance. Top up your wallet and try again.' :
                friendly === 'nonce' ? 'Transaction nonce error. Please try again.' :
                friendly === 'network' ? 'Network error. Check your connection and try again.' :
                'Payment failed. Please try again.';
            if (fundingIntentId && friendly !== 'cancelled') {
                setFundingStatus('failed');
                setFundingMessage('Wallet funding succeeded, but Coal could not complete the onchain settlement yet. You can retry from this checkout.');
            }
            setErrorMsg(friendly === 'cancelled' ? '__cancelled__' : friendlyMsg);
            if (friendly !== 'cancelled') toast('error', friendlyMsg);
            emitEmbedEvent('coal:error', {
                txHash: pendingTxHash ?? null,
                message: friendly === 'cancelled' ? 'Transaction cancelled.' : (friendly === 'gas' ? 'Not enough ETH for gas fees.' : 'Payment failed.'),
            });
            setStatus('idle');
        }
    }

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

                    <div className="bg-gray-50 p-6 rounded-2xl border-2 border-black/5 flex flex-col items-center gap-4">
                        <div className="flex items-center gap-2 text-[#27AE60] font-bold">
                            <Verify size={20} variant="Bold" />
                            <span>Transaction Verified</span>
                        </div>
                        <p className="text-sm text-gray-400">
                            {mode === 'embed' ? 'The host page has been notified. You can close this widget now.' : 'You can close this window now.'}
                        </p>
                        {mode === 'embed' && (
                            <button
                                onClick={handleEmbedClose}
                                className="mt-2 inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-5 text-sm font-bold text-[var(--color-brand-navy)] transition hover:border-black/20"
                            >
                                Close widget
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        );
    }

    return (

        <div className="min-h-screen bg-[#F8F9FA] relative overflow-hidden flex flex-col md:flex-row">
            {mode === 'embed' && (
                <button
                    onClick={handleEmbedClose}
                    aria-label="Close widget"
                    className="absolute right-4 top-4 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-white/90 text-xl font-medium text-[var(--color-brand-navy)] shadow-sm backdrop-blur transition hover:border-black/20"
                >
                    ×
                </button>
            )}
            {/* Animated Background Blobs */}
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
                        {merchant.image ? (
                            <Image src={merchant.image} alt="Merchant" width={48} height={48} className="rounded-full border-2 border-white shadow-md" />
                        ) : (
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-400 border-2 border-white shadow-md">
                                {merchant.name?.charAt(0) || 'M'}
                            </div>
                        )}
                        <div>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-0.5">Pay to</p>
                            <h3 className="font-bold text-[var(--color-brand-navy)] flex items-center gap-1.5 text-lg leading-none">
                                {merchant.name || 'Merchant'}
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
                                <p className="text-xl text-[var(--color-text-secondary)] font-medium leading-relaxed">
                                    {data.product.description || (isRecurringProduct ? "Recurring subscription" : "One-time payment")}
                                </p>
                                {isRecurringProduct && recurringLabel && (
                                    <div className="mt-5 inline-flex rounded-full border border-[var(--color-brand-orange)]/20 bg-[var(--color-brand-orange)]/10 px-4 py-2 text-sm font-bold text-[var(--color-brand-orange)]">
                                        {recurringLabel}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="mb-10">
                                {data.title ? (
                                    <div className="mb-6">
                                        <div className="w-24 h-24 bg-white rounded-[32px] flex items-center justify-center text-[var(--color-brand-orange)] mb-8 shadow-[4px_4px_0px_0px_#FF5C16] border-2 border-[var(--color-brand-navy)] rotate-[-3deg] hover:rotate-[3deg] transition-transform duration-300">
                                            <Money size={48} variant="Bold" />
                                        </div>
                                        <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-[var(--color-brand-navy)] mb-6 leading-tight">{data.title}</h1>
                                        <p className="text-xl text-[var(--color-text-secondary)] font-medium leading-relaxed">{data.description || "Complete your payment securely on Base."}</p>
                                    </div>
                                ) : (
                                    <>
                                        <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-[var(--color-brand-navy)] mb-6 leading-tight">
                                            {isDonation ? "Send Money" : "Payment Request"}
                                        </h1>
                                        <p className="text-xl text-[var(--color-text-secondary)] font-medium leading-relaxed">
                                            Complete your payment securely on Base.
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
                                <span>{formatAmount(parsedAmount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <span className="text-2xl text-gray-400 font-bold">{currency}</span>
                            </div>
                        )}
                    </div>

                    {/* Gas fee indicator */}
                    {isConnected && !errorMsg && (
                        <div className="mb-4 text-xs text-center font-medium text-gray-400">
                            ~$0.001 gas fee on Base
                        </div>
                    )}

                    {/* Inline error / cancellation notice */}
                    {errorMsg && (status === 'idle' || status === 'failed') && !pendingTxHash && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`mb-4 rounded-[20px] border p-4 ${
                                errorMsg === '__cancelled__'
                                    ? 'border-black/6 bg-gray-50'
                                    : errorMsg.includes('gas') || errorMsg.includes('ETH')
                                        ? 'border-amber-100 bg-amber-50'
                                        : 'border-red-100 bg-red-50'
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                                    errorMsg === '__cancelled__'
                                        ? 'bg-gray-200 text-gray-500'
                                        : errorMsg.includes('gas') || errorMsg.includes('ETH')
                                            ? 'bg-amber-100 text-amber-600'
                                            : 'bg-red-100 text-red-500'
                                }`}>
                                    {errorMsg === '__cancelled__' ? '↩' : '!'}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-bold leading-snug ${
                                        errorMsg === '__cancelled__'
                                            ? 'text-gray-600'
                                            : errorMsg.includes('gas') || errorMsg.includes('ETH')
                                                ? 'text-amber-800'
                                                : 'text-red-700'
                                    }`}>
                                        {errorMsg === '__cancelled__' ? 'Transaction cancelled.' : errorMsg}
                                    </p>
                                    {(errorMsg.includes('gas') || errorMsg.includes('ETH')) && (
                                        <p className="mt-1 text-xs font-medium text-amber-600">
                                            Connect MetaMask or another wallet that holds ETH.
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => setErrorMsg(null)}
                                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-black/5 text-xs font-bold transition-colors"
                                    aria-label="Dismiss"
                                >
                                    ✕
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {/* Verifying state */}
                    {status === 'verifying' && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="w-full flex flex-col items-center justify-center gap-2 py-4"
                        >
                            <div className="flex items-center gap-3 text-[var(--color-brand-navy)] font-bold text-base">
                                <Spinner size="md" />
                                Verifying on-chain...
                            </div>
                            <p className="text-xs text-gray-400 font-medium">This usually takes a few seconds</p>
                            {pendingTxHash && (
                                <a
                                    href={`${EXPLORER_URL}/tx/${pendingTxHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-400 hover:text-blue-600 font-mono underline truncate max-w-[220px]"
                                >
                                    {pendingTxHash.slice(0, 10)}...{pendingTxHash.slice(-8)}
                                </a>
                            )}
                        </motion.div>
                    )}

                    {/* Verification timeout — show txHash so user can check independently */}
                    {errorMsg && status === 'failed' && pendingTxHash && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-4 rounded-[20px] border border-amber-100 bg-amber-50 p-4"
                        >
                            <div className="flex items-start gap-3">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 text-xs font-black">⏱</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-amber-800 leading-snug">{errorMsg}</p>
                                    <a
                                        href={`${EXPLORER_URL}/tx/${pendingTxHash}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-blue-500 hover:text-blue-700 transition-colors"
                                    >
                                        Check on Basescan ↗
                                    </a>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Token Selector — hidden while verifying */}
                    {status !== 'verifying' && (
                        <div className="relative">
                            <TokenSelector
                                selected={selectedToken}
                                onChange={(token) => {
                                    setSelectedToken(token);
                                    setLifiQuote(null);
                                }}
                                quote={lifiQuote}
                                loading={quoteLoading}
                                toAmountUSDC={amountForQuote}
                                quoteUnavailableReason={canRequestRouteQuote ? null : routeQuoteHint}
                            />
                        </div>
                    )}

                    {hasPayerInfoFields && status !== 'verifying' && (
                        <div className="mt-5 mb-6 rounded-[28px] border border-black/5 bg-[var(--color-bg-base)]/80 p-5">
                            <div className="text-sm font-black text-[var(--color-brand-navy)]">Payer details</div>
                            <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--color-text-secondary)]">
                                {payerInfoConfig?.required
                                    ? 'This checkout requires payer information before payment can continue.'
                                    : 'This checkout can collect payer information before payment.'}
                            </p>
                            <div className="mt-4 grid gap-3">
                                {payerInfoConfig?.fields.map((field) => {
                                    const meta = PAYER_INFO_FIELD_META[field];
                                    return (
                                        <label key={field} className="block">
                                            <span className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
                                                {meta.label}
                                                {payerInfoConfig.required ? ' *' : ''}
                                            </span>
                                            <input
                                                type={meta.type}
                                                value={payerInfo[field] || ''}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    setPayerInfo((current) => ({ ...current, [field]: value }));
                                                    setPayerInfoErrors((current) => ({ ...current, [field]: undefined }));
                                                }}
                                                placeholder={meta.placeholder}
                                                className={`h-12 w-full rounded-full border bg-white px-5 text-sm font-medium text-[var(--color-brand-navy)] outline-none transition ${
                                                    payerInfoErrors[field]
                                                        ? 'border-red-300'
                                                        : 'border-black/10 focus:border-[var(--color-brand-orange)]'
                                                }`}
                                            />
                                            {payerInfoErrors[field] && (
                                                <span className="mt-2 block text-xs font-bold text-red-500">{payerInfoErrors[field]}</span>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {isRecurringProduct && status !== 'verifying' && (
                        <div className="mt-5 mb-6 rounded-[28px] border border-black/5 bg-[var(--color-bg-base)]/80 p-5">
                            <div className="text-sm font-black text-[var(--color-brand-navy)]">Recurring billing mandate</div>
                            <p className="mt-2 text-sm font-medium leading-relaxed text-[var(--color-text-secondary)]">
                                Your first payment activates the subscription and saves your billing mandate. Coal will generate each renewal checkout automatically on the billing cadence.
                            </p>
                            <div className="mt-4 space-y-3">
                                <label className="flex items-start gap-3 rounded-3xl bg-white px-4 py-4 text-sm font-medium text-[var(--color-text-secondary)]">
                                    <input
                                        type="checkbox"
                                        checked={recurringConsentAccepted}
                                        onChange={(e) => setRecurringConsentAccepted(e.target.checked)}
                                        className="mt-1 h-4 w-4 rounded border-black/20 text-[var(--color-brand-orange)] focus:ring-[var(--color-brand-orange)]"
                                    />
                                    <span>
                                        I approve this recurring billing schedule and want Coal to save my wallet mandate for future renewal checkouts.
                                    </span>
                                </label>
                            </div>
                        </div>
                    )}

                    {status !== 'verifying' && fundingStatus !== 'idle' && (
                        <div
                            className={`mt-5 rounded-[24px] border p-4 ${
                                fundingStatus === 'funded' || fundingStatus === 'settled'
                                    ? 'border-emerald-100 bg-emerald-50'
                                    : fundingStatus === 'failed'
                                        ? 'border-red-100 bg-red-50'
                                        : 'border-blue-100 bg-blue-50'
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <span
                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                                        fundingStatus === 'funded' || fundingStatus === 'settled'
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : fundingStatus === 'failed'
                                                ? 'bg-red-100 text-red-600'
                                                : 'bg-blue-100 text-blue-600'
                                    }`}
                                >
                                    {fundingStatus === 'funded' || fundingStatus === 'settled' ? '✓' : fundingStatus === 'failed' ? '!' : '…'}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-black text-[var(--color-brand-navy)]">
                                        {fundingStatus === 'settled'
                                            ? 'Card payment settled'
                                            : fundingStatus === 'settlement_submitted'
                                                ? 'Settlement submitted'
                                                : fundingStatus === 'route_executing'
                                                    ? 'Settlement route in progress'
                                                    : fundingStatus === 'funded'
                                            ? 'Wallet funded'
                                            : fundingStatus === 'failed'
                                                ? 'Card funding needs attention'
                                                : 'Card funding in progress'}
                                    </div>
                                    <p className="mt-1 text-sm font-medium leading-relaxed text-[var(--color-text-secondary)]">
                                        {fundingMessage}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Pay with Wallet */}
                    {status !== 'verifying' && (
                        <button
                            onClick={handlePay}
                            disabled={
                                status !== 'idle' ||
                                (isDonation && (!customAmount || (parsedCustomAmount ?? 0) <= 0)) ||
                                (hasPayerInfoFields && !payerInfoValid) ||
                                (isRecurringProduct && !recurringConsentAccepted) ||
                                (isRoutePreviewSelection && isConnected)
                            }
                            className="w-full h-16 bg-black text-white rounded-full font-bold text-lg hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none flex items-center justify-center gap-3 border-2 border-black"
                        >
                            {(status === 'idle' || status === 'failed') && (
                                <>
                                    <Wallet variant="Bold" />
                                    {!isConnected
                                        ? (isRoutePreviewSelection ? 'Connect to Preview Route' : 'Connect & Pay')
                                        : isRoutePreviewSelection
                                            ? 'Route execution coming soon'
                                            : (() => {
                                        return `Pay with ${currency}`;
                                    })()}
                                </>
                            )}
                            {status === 'connecting' && "Connecting Wallet..."}
                            {status === 'processing' && "Confirm in Wallet..."}
                        </button>
                    )}

                    {status !== 'verifying' && isRoutePreviewSelection && (
                        <p className="mt-2 text-center text-[10px] font-medium leading-relaxed text-gray-400">
                            Route preview via Li.Fi. Settles as direct {getSettlementToken().symbol}.
                        </p>
                    )}

                    {/* Divider + Card button */}
                    {status !== 'verifying' && showCardPaymentsCta && (
                        <>
                            <div className="flex items-center gap-3 my-4">
                                <div className="flex-1 h-px bg-gray-200" />
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">or buy crypto with card</span>
                                <div className="flex-1 h-px bg-gray-200" />
                            </div>

                            {cardPaymentsComingSoon ? (
                                <>
                                    <button
                                        type="button"
                                        disabled
                                        className="w-full h-14 bg-white text-black rounded-full font-bold text-base border-2 border-black/10 opacity-70 cursor-not-allowed flex items-center justify-center gap-3"
                                    >
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
                                            <path d="M2 10H22" stroke="currentColor" strokeWidth="2" />
                                            <path d="M6 14H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                        </svg>
                                        <span>Pay with Card</span>
                                        <span className="rounded-full bg-[var(--color-brand-orange)]/12 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.12em] text-[var(--color-brand-orange)]">
                                            Soon
                                        </span>
                                    </button>
                                </>
                            ) : (
                                <>
                                    <FiatOnramp
                                        walletAddress={fundingWallet?.address || null}
                                        disabled={cardFlowBlocked}
                                        onRequireWallet={() => {
                                            setFundingStatus('idle');
                                            setFundingMessage('Securely sign in to Coal so we can create or reuse your embedded wallet for the card-funded checkout.');
                                            if (!authenticated) {
                                                login();
                                                return;
                                            }

                                            if (!fundingWallet) {
                                                void createWallet().catch((error) => {
                                                    console.error('Failed to create embedded wallet', error);
                                                    const message = 'We could not create your Coal wallet yet. Please try again.';
                                                    setErrorMsg(message);
                                                    toast('error', message);
                                                });
                                            }
                                        }}
                                        onCreateFundingIntent={createCardFundingIntent}
                                        onSuccess={({ fundingIntentId: nextFundingIntentId }) => {
                                            if (nextFundingIntentId) {
                                                setFundingIntentId(nextFundingIntentId);
                                                setAutoResumeFundingIntentId(null);
                                            }
                                            setFundingStatus('submitted');
                                            setFundingMessage('Card purchase submitted. Waiting for MoonPay to confirm the wallet funding.');
                                        }}
                                    />

                                    <p className="mt-2 text-center text-[10px] font-medium leading-relaxed text-gray-400">
                                        Securely fund your Coal wallet with card, then Coal completes the onchain payment from that same wallet.
                                    </p>
                                </>
                            )}
                        </>
                    )}

                    <div className="mt-8 pt-6 border-t border-dashed border-gray-100 flex flex-col items-center justify-center gap-2">
                        <span className="text-xs font-bold uppercase text-gray-400 tracking-[0.2em]">Powered by</span>
                        <Image src="/logo.png" alt="Coal" width={48} height={48} className="object-contain opacity-80" />
                    </div>
                </div>
            </motion.div >
        </div >
    );
}
