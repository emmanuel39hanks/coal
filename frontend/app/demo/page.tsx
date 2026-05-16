'use client';

import { useState, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BlurReveal from '@/components/BlurReveal';
import { Lock, ArrowRight, Flash, Hierarchy, Card, ExportSquare } from 'iconsax-reactjs';

// ── Revenue split data ────────────────────────────────────────────────────────
const splits = [
  { label: 'Creator', pct: 70, amount: '70.00', color: 'var(--color-brand-orange)' },
  { label: 'Platform', pct: 20, amount: '20.00', color: 'var(--color-brand-blue)' },
  { label: 'Affiliate', pct: 10, amount: '10.00', color: 'var(--color-brand-lavender)' },
];

// ── Paywall article ───────────────────────────────────────────────────────────
const PREVIEW = [
  'The financial internet is being rebuilt from scratch. For decades, moving money online has required trusting a chain of intermediaries — banks, payment processors, card networks — each extracting a toll and introducing latency. Programmable payments break that model entirely.',
  'At their core, programmable payments are on-chain rules: if condition X is met, transfer Y tokens to address Z. No manual reconciliation. No settlement windows. No chargebacks engineered by middlemen. Just code executing deterministically on a public ledger.',
];

const LOCKED = [
  'The x402 protocol formalises this as an HTTP primitive. A resource can return 402 Payment Required with machine-readable payment instructions. Any client — browser, server, or AI agent — that understands x402 can pay autonomously and retry the request with proof of payment.',
  'This unlocks entirely new business models: pay-per-call APIs, micropayment paywalls, autonomous agent tooling, and split-second revenue sharing across any number of recipients. The infrastructure exists today. What remains is the developer tooling to make it trivially easy.',
  'Coal is that tooling. One API call creates a checkout session. Revenue splits are configured once and fire on every settlement. Paywalls are deployed in a single curl command. The programmable money layer is finally developer-friendly.',
];

// ── Paywall Demo ──────────────────────────────────────────────────────────────
function PaywallDemo() {
  const [state, setState] = useState<'locked' | 'processing' | 'unlocked'>('locked');

  function handleUnlock() {
    setState('processing');
    setTimeout(() => setState('unlocked'), 2000);
  }

  return (
    <div className="bg-white rounded-[32px] border-2 border-black/5 shadow-[8px_8px_0px_0px_#180D43] p-8 md:p-10">
      {/* Article header */}
      <div className="mb-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-bg-base)] text-xs font-bold text-[var(--color-brand-orange)] tracking-wide uppercase">
        x402 Paywall
      </div>
      <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-brand-navy)] tracking-tighter mb-6 mt-2">
        The Future of Programmable Payments
      </h2>

      {/* Visible preview */}
      <div className="space-y-4 text-[var(--color-text-secondary)] leading-relaxed mb-6">
        {PREVIEW.map((p, i) => <p key={i}>{p}</p>)}
      </div>

      {/* Locked section */}
      <div className="relative rounded-2xl overflow-hidden">
        <motion.div
          animate={{ filter: state === 'unlocked' ? 'blur(0px)' : 'blur(4px)', opacity: state === 'unlocked' ? 1 : 0.6 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="space-y-4 text-[var(--color-text-secondary)] leading-relaxed p-6 bg-[var(--color-bg-base)] rounded-2xl"
        >
          {LOCKED.map((p, i) => <p key={i}>{p}</p>)}
        </motion.div>

        {/* Gradient + lock overlay */}
        <AnimatePresence>
          {state !== 'unlocked' && (
            <motion.div
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl"
              style={{ background: 'linear-gradient(to bottom, transparent 0%, rgba(245,242,237,0.85) 40%, #F5F2ED 100%)' }}
            >
              <div className="text-center px-4">
                <div className="w-14 h-14 rounded-2xl bg-[var(--color-brand-navy)] flex items-center justify-center mx-auto mb-4 shadow-[4px_4px_0px_0px_var(--color-brand-orange)]">
                  <Lock size={26} variant="Bold" className="text-white" />
                </div>
                <p className="text-sm font-bold text-[var(--color-brand-navy)] mb-1">3 more paragraphs locked</p>
                <p className="text-xs text-[var(--color-text-secondary)] mb-5">Pay once to read the full article</p>

                <div className="mb-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-[var(--color-brand-navy)] text-white/70 mb-4">
                    <Flash size={12} variant="Bold" className="text-[var(--color-brand-orange)]" />
                    Demo mode — no real payment needed
                  </span>
                </div>

                <button
                  onClick={handleUnlock}
                  disabled={state === 'processing'}
                  className="group bg-[var(--color-brand-orange)] text-white font-bold px-6 py-3 rounded-full flex items-center gap-2 mx-auto shadow-[4px_4px_0px_0px_#180D43] hover:shadow-[2px_2px_0px_0px_#180D43] hover:translate-x-[2px] hover:translate-y-[2px] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {state === 'processing' ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      />
                      Processing…
                    </>
                  ) : (
                    <>
                      <Lock size={16} variant="Bold" />
                      Unlock Full Article — 0.01 USDC
                      <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {state === 'unlocked' && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex items-center gap-2 text-sm font-bold text-green-600">
          <span>✓</span> Article unlocked
        </motion.div>
      )}
    </div>
  );
}

// ── Revenue Split Bar ─────────────────────────────────────────────────────────
function SplitBar({ label, pct, amount, color, delay }: typeof splits[0] & { delay: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <div ref={ref} className="space-y-2">
      <div className="flex items-center justify-between text-sm font-bold text-[var(--color-brand-navy)]">
        <span>{label}</span>
        <span style={{ color }}>${amount}</span>
      </div>
      <div className="h-4 bg-black/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={inView ? { width: `${pct}%` } : {}}
          transition={{ duration: 0.8, delay, ease: [0.25, 0.4, 0.25, 1] }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      <p className="text-xs text-[var(--color-text-secondary)]">{pct}% of total</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DemoPage() {
  return (
    <main className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-24 md:pt-32 pb-12 md:pb-16 overflow-hidden">
        <div className="absolute top-0 right-0 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-[var(--color-brand-orange)]/15 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="container mx-auto px-4 md:px-6 text-center relative z-10">
          <BlurReveal>
            <div className="inline-flex items-center gap-2 mb-4 md:mb-6 px-4 py-2 rounded-full bg-[var(--color-brand-navy)] text-white text-xs font-bold tracking-wide uppercase border border-white/10 shadow-[3px_3px_0px_0px_var(--color-brand-orange)]">
              <Flash size={12} variant="Bold" className="text-[var(--color-brand-orange)]" />
              Live Demos
            </div>
            <h1 className="text-3xl md:text-6xl font-bold text-[var(--color-brand-navy)] tracking-tighter mb-3 md:mb-4">
              Try Coal Live
            </h1>
            <p className="text-base md:text-xl text-[var(--color-text-secondary)] max-w-xl mx-auto font-medium mb-8 md:mb-10">
              Test a real checkout, paywall, and revenue split — no signup required.
            </p>
          </BlurReveal>

          {/* Example app links */}
          <BlurReveal delay={0.1}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4 max-w-2xl mx-auto">
              <a href="https://coal-react-checkout.vercel.app" target="_blank" rel="noopener noreferrer"
                className="group w-full sm:w-auto flex items-center gap-3 px-5 py-3 rounded-2xl bg-white border-2 border-black/5 hover:border-[var(--color-brand-orange)] shadow-sm hover:shadow-[3px_3px_0px_0px_var(--color-brand-orange)] transition-all">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-brand-orange)] flex items-center justify-center shrink-0">
                  <Card size={16} variant="Bold" className="text-white" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-bold text-[var(--color-brand-navy)]">React Checkout</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">Full checkout flow</p>
                </div>
                <ExportSquare size={16} className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-brand-orange)] transition-colors shrink-0" />
              </a>

              <a href="https://agent.usecoal.xyz" target="_blank" rel="noopener noreferrer"
                className="group w-full sm:w-auto flex items-center gap-3 px-5 py-3 rounded-2xl bg-white border-2 border-black/5 hover:border-[var(--color-brand-blue)] shadow-sm hover:shadow-[3px_3px_0px_0px_var(--color-brand-blue)] transition-all">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-brand-blue)] flex items-center justify-center shrink-0">
                  <Flash size={16} variant="Bold" className="text-white" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-bold text-[var(--color-brand-navy)]">AI Agent Chat</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">Coal + 0G agent</p>
                </div>
                <ExportSquare size={16} className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-brand-blue)] transition-colors shrink-0" />
              </a>
            </div>
          </BlurReveal>
        </div>
      </section>

      {/* Section 2: Paywall Demo */}
      <section className="py-12 md:py-16 bg-white">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <BlurReveal>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-orange)] flex items-center justify-center shadow-[3px_3px_0px_0px_#180D43]">
                <Lock size={20} variant="Bold" className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-[var(--color-brand-navy)] tracking-tight">Paywall Demo</h2>
            </div>
          </BlurReveal>
          <BlurReveal delay={0.1}>
            <PaywallDemo />
          </BlurReveal>
        </div>
      </section>

      {/* Section 3: Checkout Demo */}
      <section className="py-12 md:py-16 bg-[var(--color-bg-base)]">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <BlurReveal>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-blue)] flex items-center justify-center shadow-[3px_3px_0px_0px_#180D43]">
                <span className="text-white text-base font-bold">$</span>
              </div>
              <h2 className="text-2xl font-bold text-[var(--color-brand-navy)] tracking-tight">Checkout Demo</h2>
            </div>
          </BlurReveal>
          <BlurReveal delay={0.1}>
            <div className="bg-white rounded-[32px] border-2 border-black/5 shadow-[8px_8px_0px_0px_#180D43] p-8 md:p-10 flex flex-col sm:flex-row items-center gap-8">
              <div className="w-24 h-24 rounded-3xl bg-[var(--color-bg-base)] border-2 border-[var(--color-brand-navy)] flex items-center justify-center text-5xl shadow-[4px_4px_0px_0px_var(--color-brand-orange)] shrink-0">
                🎫
              </div>
              <div className="flex-1 text-center sm:text-left">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-brand-orange)] mb-1">Digital Product</p>
                <h3 className="text-2xl font-bold text-[var(--color-brand-navy)] tracking-tight mb-1">Coal Developer Pass</h3>
                <p className="text-3xl font-bold text-[var(--color-brand-navy)] mb-4">$9.99</p>
                <a href="#" target="_blank" rel="noopener noreferrer">
                  <button className="group bg-[var(--color-brand-navy)] text-white font-bold px-6 py-3 rounded-full flex items-center gap-2 mx-auto sm:mx-0 shadow-[4px_4px_0px_0px_var(--color-brand-orange)] hover:shadow-[2px_2px_0px_0px_var(--color-brand-orange)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                    Try checkout
                    <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </a>
                <p className="text-xs text-[var(--color-text-secondary)] mt-3">This is a live testnet demo — use a Base Sepolia wallet</p>
              </div>
            </div>
          </BlurReveal>
        </div>
      </section>

      {/* Section 4: Revenue Split Demo */}
      <section className="py-12 md:py-16 bg-white">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <BlurReveal>
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-lavender)] flex items-center justify-center shadow-[3px_3px_0px_0px_#180D43]">
                <Hierarchy size={20} variant="Bold" className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-[var(--color-brand-navy)] tracking-tight">Revenue Split Demo</h2>
            </div>
          </BlurReveal>
          <BlurReveal delay={0.1}>
            <div className="bg-white rounded-[32px] border-2 border-black/5 shadow-[8px_8px_0px_0px_#180D43] p-8 md:p-10">
              <p className="text-sm font-bold text-[var(--color-text-secondary)] mb-6 uppercase tracking-wide">
                $100.00 payment split
              </p>
              <div className="space-y-6">
                {splits.map((s, i) => (
                  <SplitBar key={s.label} {...s} delay={i * 0.15} />
                ))}
              </div>
              <p className="mt-8 text-sm text-[var(--color-text-secondary)] border-t border-black/5 pt-6">
                Splits are configured once and execute automatically on every payment.
              </p>
            </div>
          </BlurReveal>
        </div>
      </section>

      {/* Section 5: CTA */}
      <section className="py-16 md:py-24 bg-[var(--color-brand-navy)] text-white">
        <div className="container mx-auto px-4 md:px-6 max-w-2xl text-center">
          <BlurReveal>
            <h2 className="text-2xl md:text-4xl font-bold tracking-tighter mb-4">Start building</h2>
            <p className="text-white/60 mb-10 font-medium">No credit card required. Testnet payments are free.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/docs">
                <button className="group bg-white text-[var(--color-brand-navy)] font-bold px-8 py-4 rounded-full flex items-center gap-2 shadow-[4px_4px_0px_0px_var(--color-brand-orange)] hover:shadow-[2px_2px_0px_0px_var(--color-brand-orange)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                  Read the docs
                  <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              </Link>
              <Link href="/signup">
                <button className="group bg-[var(--color-brand-orange)] text-white font-bold px-8 py-4 rounded-full flex items-center gap-2 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all">
                  Create account
                  <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                </button>
              </Link>
            </div>
          </BlurReveal>
        </div>
      </section>

      <Footer />
    </main>
  );
}
