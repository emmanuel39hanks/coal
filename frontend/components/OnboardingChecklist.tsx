'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TickCircle, CloseCircle, ArrowRight2 } from 'iconsax-reactjs';
import Link from 'next/link';
import useSWR from 'swr';
import { useApi } from '@/lib/api';

interface OnboardingChecklistProps {
    merchantId: string;
    hasPayoutAddress: boolean;
}

interface StepState {
    testedPayment: boolean;
    dismissed: boolean;
}

function getStorageKey(merchantId: string) {
    return `coal_onboarding_${merchantId}`;
}

function loadState(merchantId: string): StepState {
    if (typeof window === 'undefined') return { testedPayment: false, dismissed: false };
    try {
        const raw = localStorage.getItem(getStorageKey(merchantId));
        if (!raw) return { testedPayment: false, dismissed: false };
        return JSON.parse(raw);
    } catch {
        return { testedPayment: false, dismissed: false };
    }
}

function saveState(merchantId: string, state: StepState) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(getStorageKey(merchantId), JSON.stringify(state));
}

export default function OnboardingChecklist({ merchantId, hasPayoutAddress }: OnboardingChecklistProps) {
    const { fetcher } = useApi();
    const [localState, setLocalState] = useState<StepState>({ testedPayment: false, dismissed: false });
    const [mounted, setMounted] = useState(false);

    // SWR checks
    const { data: productsData } = useSWR('/api/console/products', fetcher);
    const { data: linksData } = useSWR('/api/console/links', fetcher);
    const { data: settingsData } = useSWR('/api/console/settings', fetcher);

    useEffect(() => {
        setLocalState(loadState(merchantId));
        setMounted(true);
    }, [merchantId]);

    const hasProducts = Array.isArray(productsData?.products)
        ? productsData.products.length > 0
        : Array.isArray(productsData)
        ? productsData.length > 0
        : false;

    const hasLinks = Array.isArray(linksData?.links)
        ? linksData.links.length > 0
        : Array.isArray(linksData)
        ? linksData.length > 0
        : false;

    const hasWebhook = !!(settingsData?.webhookUrl);

    const steps = [
        {
            id: 'payout',
            title: 'Set your payout address',
            description: 'Tell Coal where to send your settlement funds — payouts go directly to your wallet.',
            complete: hasPayoutAddress,
            action: { label: 'Go to Settings', href: '/console/settings' },
        },
        {
            id: 'product',
            title: 'Create your first product',
            description: 'Define what you\'re selling — name, price, and optional image.',
            complete: hasProducts,
            action: { label: 'Create Product', href: '/console/products?new=true' },
        },
        {
            id: 'link',
            title: 'Create a payment link',
            description: 'Get a shareable URL that opens a hosted checkout page instantly.',
            complete: hasLinks,
            action: { label: 'Create Link', href: '/console/payment-links?new=true' },
        },
        {
            id: 'test',
            title: 'Test your first payment',
            description: 'Open your payment link and complete a test checkout.',
            complete: localState.testedPayment,
            action: null, // button, not a link
        },
        {
            id: 'webhook',
            title: 'Set up a webhook',
            description: 'Receive real-time payment notifications on your server.',
            complete: hasWebhook,
            action: { label: 'Configure Webhook', href: '/console/settings' },
        },
    ];

    const completedCount = steps.filter((s) => s.complete).length;
    const allDone = completedCount === steps.length;

    const handleMarkTested = useCallback(() => {
        const next = { ...localState, testedPayment: true };
        setLocalState(next);
        saveState(merchantId, next);
    }, [localState, merchantId]);

    const handleDismiss = useCallback(() => {
        const next = { ...localState, dismissed: true };
        setLocalState(next);
        saveState(merchantId, next);
    }, [localState, merchantId]);

    // Don't render until client-side state is loaded (avoids hydration mismatch)
    if (!mounted) return null;
    if (localState.dismissed) return null;

    const progressPercent = Math.round((completedCount / steps.length) * 100);

    return (
        <AnimatePresence>
            <motion.div
                key="onboarding-checklist"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className="relative overflow-hidden rounded-[32px] bg-white p-6 md:p-8"
            >
                {/* Dismiss button */}
                {!allDone && (
                    <button
                        onClick={handleDismiss}
                        className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label="Dismiss onboarding checklist"
                    >
                        <CloseCircle size={22} variant="Bold" />
                    </button>
                )}

                {allDone ? (
                    /* Celebration state */
                    <div className="flex flex-col items-center justify-center py-4 text-center gap-3">
                        <div className="text-4xl">🎉</div>
                        <h2 className="text-2xl font-black text-[var(--color-brand-navy)] tracking-tight">
                            You're ready to accept payments!
                        </h2>
                        <p className="text-[var(--color-text-secondary)] font-medium max-w-sm">
                            All setup steps are complete. Your Coal account is fully configured.
                        </p>
                        <button
                            onClick={handleDismiss}
                            className="mt-2 bg-black text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px]"
                        >
                            Dismiss
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="mb-5 pr-8">
                            <h2 className="text-xl font-black text-[var(--color-brand-navy)] tracking-tight">
                                Finish setting up your account
                            </h2>
                            <p className="text-[var(--color-text-secondary)] font-medium text-sm mt-0.5">
                                {completedCount} of {steps.length} steps complete
                            </p>
                        </div>

                        {/* Progress bar */}
                        <div className="mb-6 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-[var(--color-brand-orange)] rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                            />
                        </div>

                        {/* Steps */}
                        <div className="space-y-3">
                            {steps.map((step) => (
                                <div
                                    key={step.id}
                                    className={`flex items-start gap-4 p-4 rounded-2xl transition-colors ${
                                        step.complete
                                            ? 'bg-green-50/60'
                                            : 'bg-[var(--color-bg-base)] hover:bg-orange-50/40'
                                    }`}
                                >
                                    {/* Icon */}
                                    <div className="mt-0.5 shrink-0">
                                        {step.complete ? (
                                            <TickCircle
                                                size={22}
                                                variant="Bold"
                                                className="text-green-500"
                                            />
                                        ) : (
                                            <div className="w-[22px] h-[22px] rounded-full border-2 border-gray-300" />
                                        )}
                                    </div>

                                    {/* Text */}
                                    <div className="flex-1 min-w-0">
                                        <p
                                            className={`font-bold text-sm ${
                                                step.complete
                                                    ? 'text-gray-400 line-through'
                                                    : 'text-[var(--color-brand-navy)]'
                                            }`}
                                        >
                                            {step.title}
                                        </p>
                                        {!step.complete && (
                                            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 font-medium">
                                                {step.description}
                                            </p>
                                        )}
                                    </div>

                                    {/* Action */}
                                    {!step.complete && (
                                        <div className="shrink-0">
                                            {step.id === 'test' ? (
                                                <button
                                                    onClick={handleMarkTested}
                                                    className="flex items-center gap-1 text-xs font-bold text-[var(--color-brand-orange)] hover:text-orange-700 transition-colors whitespace-nowrap"
                                                >
                                                    I've tested it
                                                    <ArrowRight2 size={13} />
                                                </button>
                                            ) : step.action ? (
                                                <Link
                                                    href={step.action.href}
                                                    className="flex items-center gap-1 text-xs font-bold text-[var(--color-brand-orange)] hover:text-orange-700 transition-colors whitespace-nowrap"
                                                >
                                                    {step.action.label}
                                                    <ArrowRight2 size={13} />
                                                </Link>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
