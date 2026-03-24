'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight } from 'iconsax-reactjs';
import BlurReveal from '@/components/BlurReveal';
import { useAuth as usePrivy } from '@/lib/auth';

export default function SignupPage() {
  const router = useRouter();
  const { ready, authenticated, login } = usePrivy();

  useEffect(() => {
    if (ready && authenticated) {
      router.replace('/console');
    }
  }, [ready, authenticated, router]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-[var(--color-bg-base)]">
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
              Create your account
            </h1>
            <p className="text-[var(--color-text-secondary)] font-medium">
              Start accepting crypto payments in minutes with Privy.
            </p>
          </BlurReveal>
        </div>

        <button
          onClick={login}
          className="w-full h-14 bg-black text-white rounded-full font-bold text-lg flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none mt-2"
        >
          Get Started
          <ArrowRight size={20} variant="Linear" />
        </button>

        <p className="text-[10px] text-center text-[var(--color-text-secondary)] mt-6 font-medium">
          Email · Google · Apple · Passkey — no wallet required to sign in
        </p>

        <div className="mt-8 text-center">
          <p className="text-[var(--color-text-secondary)] font-medium">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-[var(--color-brand-navy)] font-bold hover:text-[var(--color-brand-orange)] transition-colors underline decoration-2 decoration-[var(--color-brand-orange)]/30 hover:decoration-[var(--color-brand-orange)] underline-offset-4"
            >
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </main>
  );
}
