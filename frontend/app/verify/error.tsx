'use client';

import { motion } from 'framer-motion';
import { Warning2, Refresh } from 'iconsax-reactjs';

export default function VerifyError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-white">
            {/* Background blobs */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[var(--color-brand-orange)]/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/4 z-0 pointer-events-none animate-pulse" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[var(--color-brand-blue)]/10 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4 z-0 pointer-events-none" />

            <div className="container mx-auto px-6 relative z-10 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="flex flex-col items-center"
                >
                    <div className="w-24 h-24 bg-gray-50 rounded-3xl flex items-center justify-center mb-8 rotate-[-6deg] border-2 border-[var(--color-brand-navy)] shadow-[8px_8px_0px_0px_rgba(0,0,0,0.08)]">
                        <Warning2 size={48} variant="Bold" className="text-[var(--color-brand-orange)]" />
                    </div>

                    <h1 className="text-6xl md:text-7xl font-black text-[var(--color-brand-navy)] tracking-tighter mb-4">
                        Oops.
                    </h1>

                    <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-brand-navy)] mb-6">
                        Verification error
                    </h2>

                    <p className="text-lg text-[var(--color-text-secondary)] max-w-md mx-auto mb-10 font-medium">
                        Something went wrong while verifying the receipt. You can try again — if the problem persists,
                        please reach out to support.
                    </p>

                    <div className="flex items-center gap-4 flex-wrap justify-center">
                        <button
                            onClick={reset}
                            className="group bg-black text-white px-8 py-4 rounded-full text-lg font-bold flex items-center gap-2 shadow-[6px_6px_0px_0px_#FF5C16] hover:shadow-[3px_3px_0px_0px_#FF5C16] hover:translate-x-[3px] hover:translate-y-[3px] transition-all active:translate-x-[6px] active:translate-y-[6px] active:shadow-none"
                        >
                            <Refresh size={20} variant="Linear" className="group-hover:rotate-180 transition-transform duration-500" />
                            Try again
                        </button>

                        <a
                            href="/verify"
                            className="px-8 py-4 rounded-full text-lg font-bold border-2 border-[var(--color-brand-navy)] text-[var(--color-brand-navy)] hover:bg-[var(--color-brand-navy)] hover:text-white transition-all"
                        >
                            Back to Verify
                        </a>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
