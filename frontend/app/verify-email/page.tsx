'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';

// Email verification is now handled by Privy — this page redirects to login
export default function VerifyEmailPage() {
    const router = useRouter();

    useEffect(() => {
        // Privy handles email verification internally via their modal
        // Redirect to login after a brief moment
        const timer = setTimeout(() => {
            router.replace('/login');
        }, 3000);
        return () => clearTimeout(timer);
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] px-4">
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full max-w-md text-center"
            >
                <Link href="/" className="inline-block mb-10">
                    <span className="text-2xl font-bold text-white tracking-tight">
                        coal<span className="text-[#FF5A00]">.</span>
                    </span>
                </Link>

                <div className="w-16 h-16 rounded-full bg-[#FF5A00]/10 flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-[#FF5A00]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2H5a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2z" />
                    </svg>
                </div>
                <h1 className="text-2xl font-semibold text-white mb-3">Email verification</h1>
                <p className="text-[#888] text-sm mb-8">
                    Authentication is now handled by Privy. Redirecting to login...
                </p>

                <p className="mt-10 text-xs text-[#555]">
                    <Link href="/login" className="hover:text-[#888] transition-colors">Go to login</Link>
                </p>
            </motion.div>
        </div>
    );
}
