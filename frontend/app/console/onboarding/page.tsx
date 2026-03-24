'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useApi } from '@/lib/api';
import useSWR from 'swr';
import { useAuth } from '@/lib/auth';
import { parseAmountInput } from '@/lib/utils';

const STEPS = [
    { label: 'Welcome' },
    { label: 'Business Info' },
    { label: 'Payout Address' },
    { label: 'First Product' },
    { label: 'API Key' },
    { label: "You're all set!" },
];

export default function OnboardingPage() {
    const router = useRouter();
    const { ready, authenticated } = useAuth();
    const { request, fetcher } = useApi();
    const {
        data: onboarding,
        mutate: mutateOnboarding,
        isLoading: onboardingLoading,
    } = useSWR(
        ready && authenticated ? '/api/console/onboarding' : null,
        fetcher
    );
    const { data: settings } = useSWR(
        ready && authenticated ? '/api/console/settings' : null,
        fetcher
    );
    const [currentStep, setCurrentStep] = useState(0);

    // Step 1 — Business Info
    const [displayName, setDisplayName] = useState('');

    // Step 2 — Payout Address
    const [payoutAddress, setPayoutAddress] = useState('');

    // Step 3 — First Product
    const [productName, setProductName] = useState('');
    const [productPrice, setProductPrice] = useState('');

    // Step 4 — API Key
    const [apiKeyGenerated, setApiKeyGenerated] = useState(false);
    const [apiKeySecret, setApiKeySecret] = useState('');
    const [copiedKey, setCopiedKey] = useState(false);
    const [generatingKey, setGeneratingKey] = useState(false);

    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!onboarding) return;

        if (onboarding.complete) {
            router.replace('/console');
            return;
        }

        setCurrentStep(Math.max(0, Math.min(onboarding.step ?? 0, STEPS.length - 1)));
    }, [onboarding, router]);

    useEffect(() => {
        if (settings?.name && !displayName) {
            setDisplayName(settings.name);
        }
    }, [settings?.name, displayName]);

    useEffect(() => {
        if (settings?.payoutAddress && !payoutAddress) {
            setPayoutAddress(settings.payoutAddress);
        }
    }, [settings?.payoutAddress, payoutAddress]);

    const advanceOnboarding = async (step: number) => {
        const next = await request('/api/console/onboarding', {
            method: 'POST',
            body: JSON.stringify({ step }),
        });
        await mutateOnboarding(next, { revalidate: false });
        if (!next.complete) {
            setCurrentStep(Math.max(0, Math.min(next.step ?? 0, STEPS.length - 1)));
        }
        return next;
    };

    // Step 0 — Welcome
    const handleGetStarted = async () => {
        await advanceOnboarding(1);
    };

    // Step 1 — Business Info
    const handleSaveBusinessInfo = async () => {
        if (!displayName.trim()) return;
        setSaving(true);
        try {
            await request('/api/console/settings', {
                method: 'PUT',
                body: JSON.stringify({ name: displayName }),
            });
            await advanceOnboarding(2);
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    // Step 2 — Payout Address
    const handleSavePayoutAddress = async () => {
        setSaving(true);
        try {
            await request('/api/console/settings', {
                method: 'PUT',
                body: JSON.stringify({ payoutAddress }),
            });
            await advanceOnboarding(3);
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const handleSkipPayoutAddress = async () => {
        await advanceOnboarding(3);
    };

    // Step 3 — Create First Product
    const handleCreateProduct = async () => {
        const price = parseAmountInput(productPrice);
        if (!productName.trim() || price === null) return;
        setSaving(true);
        try {
            await request('/api/console/products', {
                method: 'POST',
                body: JSON.stringify({ name: productName, price }),
            });
            await advanceOnboarding(4);
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const handleSkipProduct = async () => {
        await advanceOnboarding(4);
    };

    // Step 4 — API Key
    const handleGenerateKey = async () => {
        setGeneratingKey(true);
        try {
            const json = await request('/api/console/keys', {
                method: 'POST',
                body: JSON.stringify({ name: 'My First Key' }),
            });
            setApiKeySecret(json.key.secret);
            setApiKeyGenerated(true);
        } catch (e) {
            console.error(e);
        } finally {
            setGeneratingKey(false);
        }
    };

    const handleCopyKey = () => {
        navigator.clipboard.writeText(apiKeySecret);
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
    };

    const handleKeyDone = async () => {
        await advanceOnboarding(5);
    };

    // Step 5 — Complete
    const handleGoToDashboard = async () => {
        setSaving(true);
        try {
            await advanceOnboarding(7);
            router.replace('/console');
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    const totalSteps = STEPS.length;

    if (!ready || !authenticated || onboardingLoading || !onboarding) {
        return (
            <div className="min-h-screen bg-[var(--color-bg-base)] flex items-center justify-center p-6">
                <div className="bg-white rounded-[40px] border-2 border-black/5 px-8 py-6 shadow-sm">
                    <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
                        Loading onboarding
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--color-bg-base)] flex flex-col items-center justify-center p-6">
            {/* Progress bar */}
            {currentStep > 0 && currentStep < totalSteps - 1 && (
                <div className="w-full max-w-lg mb-8">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                            Step {currentStep} of {totalSteps - 2}
                        </span>
                        <span className="text-xs font-bold text-[var(--color-brand-orange)]">
                            {STEPS[currentStep].label}
                        </span>
                    </div>
                    <div className="h-2 bg-black/5 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-[var(--color-brand-orange)] rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${((currentStep) / (totalSteps - 2)) * 100}%` }}
                            transition={{ duration: 0.4 }}
                        />
                    </div>
                </div>
            )}

            <AnimatePresence mode="wait">
                {/* Step 0 — Welcome */}
                {currentStep === 0 && (
                    <motion.div
                        key="step-0"
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -24 }}
                        className="bg-white rounded-[48px] border-2 border-black/5 p-12 w-full max-w-lg shadow-sm text-center"
                    >
                        <div className="w-20 h-20 bg-black rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-[4px_4px_0px_0px_#FF5C16]">
                            <span className="text-white font-black text-3xl">C</span>
                        </div>
                        <h1 className="text-4xl font-black text-[var(--color-brand-navy)] mb-3 tracking-tight">
                            Welcome to Coal
                        </h1>
                        <p className="text-[var(--color-text-secondary)] font-medium text-lg mb-10">
                            Let's get you set up to start accepting crypto payments.
                        </p>
                        <button
                            onClick={handleGetStarted}
                            className="w-full h-14 bg-black text-white rounded-full font-bold text-lg shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px]"
                        >
                            Get Started
                        </button>
                    </motion.div>
                )}

                {/* Step 1 — Business Info */}
                {currentStep === 1 && (
                    <motion.div
                        key="step-1"
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -24 }}
                        className="bg-white rounded-[48px] border-2 border-black/5 p-10 w-full max-w-lg shadow-sm"
                    >
                        <h2 className="text-3xl font-black text-[var(--color-brand-navy)] mb-2 tracking-tight">Business Info</h2>
                        <p className="text-[var(--color-text-secondary)] font-medium mb-8">
                            What should we call your store?
                        </p>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-[var(--color-brand-navy)] mb-2 pl-4">
                                    Display Name
                                </label>
                                <input
                                    value={displayName}
                                    onChange={e => setDisplayName(e.target.value)}
                                    className="w-full h-14 px-6 rounded-full bg-gray-100 border-2 border-transparent focus:border-[var(--color-brand-orange)] outline-none font-medium text-[var(--color-brand-navy)]"
                                    placeholder="My Store"
                                    autoFocus
                                />
                            </div>
                            <button
                                onClick={handleSaveBusinessInfo}
                                disabled={saving || !displayName.trim()}
                                className="w-full h-14 bg-black text-white rounded-full font-bold text-lg shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px] disabled:opacity-50 disabled:pointer-events-none"
                            >
                                {saving ? 'Saving...' : 'Save & Continue'}
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Step 2 — Payout Address */}
                {currentStep === 2 && (
                    <motion.div
                        key="step-2"
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -24 }}
                        className="bg-white rounded-[48px] border-2 border-black/5 p-10 w-full max-w-lg shadow-sm"
                    >
                        <h2 className="text-3xl font-black text-[var(--color-brand-navy)] mb-2 tracking-tight">Payout Address</h2>
                        <p className="text-[var(--color-text-secondary)] font-medium mb-2">
                            Enter the wallet address where you'd like to receive payouts.
                        </p>
                        <p className="text-xs text-[var(--color-text-secondary)] mb-8 pl-1">
                            All sales proceeds will be settled to this address on Mainnet. You can change this later in Settings.
                        </p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-[var(--color-brand-navy)] mb-2 pl-4">
                                    Wallet Address
                                </label>
                                <input
                                    value={payoutAddress}
                                    onChange={e => setPayoutAddress(e.target.value)}
                                    className="w-full h-14 px-6 rounded-full bg-gray-100 border-2 border-transparent focus:border-[var(--color-brand-orange)] outline-none font-mono text-sm text-[var(--color-brand-navy)]"
                                    placeholder="0x..."
                                />
                            </div>
                            <button
                                onClick={handleSavePayoutAddress}
                                disabled={saving || !payoutAddress.trim()}
                                className="w-full h-14 bg-black text-white rounded-full font-bold text-lg shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px] disabled:opacity-50 disabled:pointer-events-none"
                            >
                                {saving ? 'Saving...' : 'Save & Continue'}
                            </button>
                            <button
                                onClick={handleSkipPayoutAddress}
                                className="w-full h-12 text-[var(--color-text-secondary)] font-bold hover:text-[var(--color-brand-navy)] transition-colors"
                            >
                                Skip for now
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Step 3 — Create First Product */}
                {currentStep === 3 && (
                    <motion.div
                        key="step-3"
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -24 }}
                        className="bg-white rounded-[48px] border-2 border-black/5 p-10 w-full max-w-lg shadow-sm"
                    >
                        <h2 className="text-3xl font-black text-[var(--color-brand-navy)] mb-2 tracking-tight">Create Your First Product</h2>
                        <p className="text-[var(--color-text-secondary)] font-medium mb-8">
                            Products let you create shareable payment links in seconds.
                        </p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-[var(--color-brand-navy)] mb-2 pl-4">
                                    Product Name
                                </label>
                                <input
                                    value={productName}
                                    onChange={e => setProductName(e.target.value)}
                                    className="w-full h-14 px-6 rounded-full bg-gray-100 border-2 border-transparent focus:border-[var(--color-brand-orange)] outline-none font-medium text-[var(--color-brand-navy)]"
                                    placeholder="e.g. Digital Download"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-[var(--color-brand-navy)] mb-2 pl-4">
                                    Price
                                </label>
                                <input
                                    value={productPrice}
                                    onChange={e => setProductPrice(e.target.value)}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className="w-full h-14 px-6 rounded-full bg-gray-100 border-2 border-transparent focus:border-[var(--color-brand-orange)] outline-none font-medium text-[var(--color-brand-navy)]"
                                    placeholder="10.00"
                                />
                            </div>
                            <button
                                onClick={handleCreateProduct}
                                disabled={saving || !productName.trim() || !productPrice.trim()}
                                className="w-full h-14 bg-black text-white rounded-full font-bold text-lg shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px] disabled:opacity-50 disabled:pointer-events-none"
                            >
                                {saving ? 'Creating...' : 'Create Product'}
                            </button>
                            <button
                                onClick={handleSkipProduct}
                                className="w-full h-12 text-[var(--color-text-secondary)] font-bold hover:text-[var(--color-brand-navy)] transition-colors"
                            >
                                Skip
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* Step 4 — Get API Key */}
                {currentStep === 4 && (
                    <motion.div
                        key="step-4"
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -24 }}
                        className="bg-white rounded-[48px] border-2 border-black/5 p-10 w-full max-w-lg shadow-sm"
                    >
                        <h2 className="text-3xl font-black text-[var(--color-brand-navy)] mb-2 tracking-tight">Get Your API Key</h2>
                        <p className="text-[var(--color-text-secondary)] font-medium mb-8">
                            Use your API key to create checkout sessions programmatically from your backend.
                        </p>

                        {!apiKeyGenerated ? (
                            <button
                                onClick={handleGenerateKey}
                                disabled={generatingKey}
                                className="w-full h-14 bg-black text-white rounded-full font-bold text-lg shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px] disabled:opacity-50"
                            >
                                {generatingKey ? 'Generating...' : 'Generate API Key'}
                            </button>
                        ) : (
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-[var(--color-brand-navy)] mb-2 pl-4">
                                        Your Secret Key — copy it now
                                    </label>
                                    <div className="bg-gray-100 p-4 rounded-2xl flex items-center justify-between border-2 border-dashed border-gray-300 gap-4">
                                        <code className="font-mono text-xs break-all text-[var(--color-brand-navy)]">
                                            {apiKeySecret}
                                        </code>
                                        <button
                                            onClick={handleCopyKey}
                                            className="shrink-0 p-2 hover:bg-white rounded-lg transition-colors"
                                        >
                                            {copiedKey ? (
                                                <span className="text-xs font-bold text-green-600">Copied!</span>
                                            ) : (
                                                <span className="text-xs font-bold text-[var(--color-brand-orange)]">Copy</span>
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-xs text-red-500 font-medium pl-4 mt-2">
                                        You won't be able to see this key again after you continue.
                                    </p>
                                </div>
                                <button
                                    onClick={handleKeyDone}
                                    className="w-full h-14 bg-black text-white rounded-full font-bold text-lg shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px]"
                                >
                                    Continue
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Step 5 — You're all set! */}
                {currentStep === 5 && (
                    <motion.div
                        key="step-5"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white rounded-[48px] border-2 border-black/5 p-12 w-full max-w-lg shadow-sm text-center"
                    >
                        <div className="w-24 h-24 bg-black rounded-full flex items-center justify-center mx-auto mb-8 shadow-[4px_4px_0px_0px_#27AE60]">
                            <span className="text-4xl">🎉</span>
                        </div>
                        <h2 className="text-4xl font-black text-[var(--color-brand-navy)] mb-3 tracking-tight">
                            You're all set!
                        </h2>
                        <p className="text-[var(--color-text-secondary)] font-medium text-lg mb-10">
                            Your Coal account is ready. Start accepting crypto payments from anywhere in the world.
                        </p>
                        <button
                            onClick={handleGoToDashboard}
                            disabled={saving}
                            className="w-full h-14 bg-black text-white rounded-full font-bold text-lg shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px] disabled:opacity-50"
                        >
                            {saving ? 'Loading...' : 'Go to Dashboard'}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
