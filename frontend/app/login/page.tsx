'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Google } from 'iconsax-reactjs';
import BlurReveal from '@/components/BlurReveal';

export default function LoginPage() {
    const [isSignUp, setIsSignUp] = useState(false);

    return (
        <main className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-[var(--color-bg-base)]">
            {/* Background blobs similar to Hero */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[var(--color-brand-orange)]/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/4 z-0 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[var(--color-brand-blue)]/10 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4 z-0 pointer-events-none" />

            <motion.div
                layout
                className="relative z-10 w-full max-w-md bg-white p-8 md:p-12 rounded-[48px] border-2 border-black/5 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.05)]"
            >
                <div className="text-center mb-10">
                    <Link href="/" className="inline-block mb-8 hover:scale-105 transition-transform">
                        <span className="text-5xl font-black tracking-tighter text-[var(--color-brand-navy)]">coal</span>
                    </Link>
                    <BlurReveal delay={0.1}>
                        <h1 className="text-3xl font-bold text-[var(--color-brand-navy)] mb-2 tracking-tight">
                            {isSignUp ? 'Create account' : 'Welcome back'}
                        </h1>
                        <p className="text-[var(--color-text-secondary)] font-medium">
                            {isSignUp ? 'Start building programmable payments.' : 'Enter your details to access your dashboard.'}
                        </p>
                    </BlurReveal>
                </div>

                <div className="space-y-4">
                    <AnimatePresence mode="popLayout">
                        {isSignUp && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-[var(--color-brand-navy)] mb-2 pl-4">Full Name</label>
                                        <input
                                            type="text"
                                            placeholder="Satoshi Nakamoto"
                                            className="w-full h-14 px-6 rounded-full bg-gray-100 border-2 border-transparent focus:border-[var(--color-brand-orange)] focus:bg-white outline-none transition-all font-medium text-[var(--color-brand-navy)] placeholder:text-black/20"
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div>
                        <label className="block text-sm font-bold text-[var(--color-brand-navy)] mb-2 pl-4">Email</label>
                        <input
                            type="email"
                            placeholder="you@company.com"
                            className="w-full h-14 px-6 rounded-full bg-gray-100 border-2 border-transparent focus:border-[var(--color-brand-orange)] focus:bg-white outline-none transition-all font-medium text-[var(--color-brand-navy)] placeholder:text-black/20"
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2 pl-4 pr-2">
                            <label className="text-sm font-bold text-[var(--color-brand-navy)]">Password</label>
                            {!isSignUp && (
                                <Link href="#" className="text-xs font-bold text-[var(--color-brand-orange)] hover:underline">Forgot?</Link>
                            )}
                        </div>
                        <input
                            type="password"
                            placeholder="••••••••"
                            className="w-full h-14 px-6 rounded-full bg-gray-100 border-2 border-transparent focus:border-[var(--color-brand-orange)] focus:bg-white outline-none transition-all font-medium text-[var(--color-brand-navy)] placeholder:text-black/20"
                        />
                    </div>

                    <button className="w-full h-14 bg-black text-white rounded-full font-bold text-lg flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none mt-2">
                        {isSignUp ? 'Sign Up' : 'Sign In'}
                        <ArrowRight size={20} variant="Linear" />
                    </button>

                    <div className="relative py-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-black/5"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-[var(--color-text-secondary)] font-medium">Or continue with</span>
                        </div>
                    </div>

                    <button className="w-full h-14 bg-white text-[var(--color-brand-navy)] rounded-full font-bold text-lg flex items-center justify-center gap-2 border-2 border-black/5 shadow-[4px_4px_0px_0px_#180D43] hover:shadow-[2px_2px_0px_0px_#180D43] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none">
                        <Google size={20} variant="Bold" />
                        Google
                    </button>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-[var(--color-text-secondary)] font-medium">
                        {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                        <button
                            onClick={() => setIsSignUp(!isSignUp)}
                            className="ml-2 text-[var(--color-brand-navy)] font-bold hover:text-[var(--color-brand-orange)] transition-colors underline decoration-2 decoration-[var(--color-brand-orange)]/30 hover:decoration-[var(--color-brand-orange)] underline-offset-4"
                        >
                            {isSignUp ? 'Log in' : 'Sign up'}
                        </button>
                    </p>
                </div>
            </motion.div>
        </main>
    );
}
