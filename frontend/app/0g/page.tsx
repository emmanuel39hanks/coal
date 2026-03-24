import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BlurReveal from '@/components/BlurReveal';
import {
  Lock,
  Flash,
  Box,
  ArrowRight,
  Shield,
  Cpu,
  Verify,
  Global,
} from 'iconsax-reactjs';

export const metadata: Metadata = {
  title: 'Coal x 0G — Payments with Permanent Proof',
  description:
    'Every Coal payment comes with a verifiable receipt stored permanently on 0G. Dispute-proof records, AI-native commerce, and merchant memory — built in.',
};

function FeatureCard({
  icon: Icon,
  title,
  description,
  delay = 0,
}: {
  icon: any;
  title: string;
  description: string;
  delay?: number;
}) {
  return (
    <BlurReveal delay={delay}>
      <div className="p-8 bg-white rounded-[32px] border-2 border-black/8 hover:border-[var(--color-brand-orange)] hover:-translate-y-1 transition-all duration-300 h-full shadow-sm hover:shadow-[4px_4px_0px_0px_var(--color-brand-orange)]">
        <div className="w-12 h-12 rounded-2xl bg-[var(--color-bg-base)] flex items-center justify-center mb-5 border border-black/8">
          <Icon size={24} variant="Bold" className="text-[var(--color-brand-navy)]" />
        </div>
        <h3 className="text-lg font-bold mb-2 text-[var(--color-brand-navy)] tracking-tight">{title}</h3>
        <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed font-medium">{description}</p>
      </div>
    </BlurReveal>
  );
}

export default function ZeroGPage() {
  return (
    <main className="min-h-screen">
      <Navbar />

      {/* ─── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(255,92,22,0.16),transparent_30%),radial-gradient(circle_at_left_35%,rgba(67,98,209,0.14),transparent_26%),linear-gradient(180deg,#f8f5ef_0%,#f5f2ed_55%,#f5f2ed_100%)]">
        <div className="container mx-auto px-6 pt-40 pb-28 md:pt-48 md:pb-32">
          <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">

            {/* Left — copy */}
            <div className="flex-1 min-w-0">
              <BlurReveal>
                <div className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white/80 px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-[var(--color-brand-orange)] shadow-sm mb-6">
                  Coal x 0G
                </div>
                <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-[var(--color-brand-navy)] leading-[0.95]">
                  Payments with<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-brand-orange)] to-[#FF915C]">
                    permanent proof.
                  </span>
                </h1>
                <p className="mt-6 max-w-xl text-lg md:text-xl leading-8 font-medium text-[var(--color-text-secondary)]">
                  Every payment processed through Coal produces a tamper-proof receipt stored permanently on 0G. Dispute-proof records, AI-native paywalls, and portable merchant identity — without any extra work on your end.
                </p>
                <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <Link
                    href="#what-you-get"
                    className="inline-flex items-center gap-2 rounded-full bg-black px-6 py-3.5 text-sm font-bold text-white shadow-[6px_6px_0px_0px_#FF5C16] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_#FF5C16]"
                  >
                    What you get
                    <ArrowRight size={16} variant="Linear" />
                  </Link>
                  <Link
                    href="/demo"
                    className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white/85 px-6 py-3.5 text-sm font-bold text-[var(--color-brand-navy)] shadow-sm transition-all hover:border-[var(--color-brand-orange)]/30 hover:text-[var(--color-brand-orange)]"
                  >
                    Live demo
                    <ArrowRight size={16} variant="Linear" />
                  </Link>
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  {['Permanent receipts', 'AI-ready paywalls', 'No disputes'].map((tag) => (
                    <span key={tag} className="rounded-full border border-black/6 bg-white/70 px-3 py-1.5 text-sm font-semibold text-[var(--color-text-secondary)]">
                      {tag}
                    </span>
                  ))}
                </div>
              </BlurReveal>
            </div>

            {/* Right — 0G logo */}
            <div className="flex-shrink-0 lg:w-[420px] flex items-center justify-center">
              <BlurReveal delay={0.15}>
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-[var(--color-brand-orange)]/15 blur-[80px] scale-110" />
                  <Image
                    src="/0g-logo.png"
                    alt="0G"
                    width={380}
                    height={380}
                    className="relative w-[280px] md:w-[380px] drop-shadow-2xl"
                    priority
                  />
                </div>
              </BlurReveal>
            </div>

          </div>
        </div>
      </div>

      {/* ─── What you get ──────────────────────────────────────────────────── */}
      <section id="what-you-get" className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <BlurReveal>
            <div className="inline-block mb-4 px-3 py-1 rounded-full bg-[var(--color-bg-base)] text-xs font-bold text-[var(--color-brand-orange)] tracking-wide uppercase">
              What you get
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-16 text-[var(--color-brand-navy)] tracking-tighter max-w-xl">
              One layer. Four superpowers.
            </h2>
          </BlurReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <FeatureCard
              icon={Lock}
              title="Receipts no one can fake"
              description="Every payment you receive is stamped with a permanent, publicly verifiable record. If a customer disputes a charge, the proof is on-chain — immutable and impossible to alter."
              delay={0.05}
            />
            <FeatureCard
              icon={Flash}
              title="Paywalls that AI agents can use"
              description="AI agents are buying things on behalf of users right now. Coal x 0G lets you publish access terms that autonomous agents can read, pay, and verify — opening your product to the agentic economy."
              delay={0.1}
            />
            <FeatureCard
              icon={Box}
              title="Your merchant identity, portable"
              description="Your product catalog, pricing, and settings are stored outside any single app. Switch infrastructure, update your stack, or migrate — your identity and history move with you."
              delay={0.15}
            />
            <FeatureCard
              icon={Cpu}
              title="AI commerce, ready to go"
              description="Open endpoints for AI models to query your catalog, verify buyer access, and route payments. First-class AI commerce without custom integration work."
              delay={0.2}
            />
          </div>
        </div>
      </section>

      {/* ─── How it works ──────────────────────────────────────────────────── */}
      <section className="py-24 bg-[var(--color-bg-base)]">
        <div className="container mx-auto px-6">
          <BlurReveal>
            <div className="inline-block mb-4 px-3 py-1 rounded-full bg-white text-xs font-bold text-[var(--color-brand-orange)] tracking-wide uppercase border border-black/8">
              How it works
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-16 text-[var(--color-brand-navy)] tracking-tighter max-w-xl">
              Pay once. Proved forever.
            </h2>
          </BlurReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <BlurReveal delay={0.1}>
              <div className="flex flex-col gap-5 group">
                <div className="w-14 h-14 rounded-2xl bg-[var(--color-brand-navy)] text-white flex items-center justify-center shrink-0 font-bold text-xl shadow-[4px_4px_0px_0px_var(--color-brand-orange)] group-hover:scale-110 transition-transform duration-300">
                  1
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2 text-[var(--color-brand-navy)]">Customer pays</h3>
                  <p className="text-[var(--color-text-secondary)] leading-relaxed font-medium">
                    The payment settles on Base — fast, non-custodial, and direct to your wallet. Exactly as you know it.
                  </p>
                </div>
              </div>
            </BlurReveal>

            <BlurReveal delay={0.2}>
              <div className="flex flex-col gap-5 group">
                <div className="w-14 h-14 rounded-2xl bg-white border-2 border-[var(--color-brand-navy)] text-[var(--color-brand-navy)] flex items-center justify-center shrink-0 font-bold text-xl shadow-[4px_4px_0px_0px_var(--color-brand-navy)] group-hover:scale-110 transition-transform duration-300">
                  2
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2 text-[var(--color-brand-navy)]">Receipt is locked in</h3>
                  <p className="text-[var(--color-text-secondary)] leading-relaxed font-medium">
                    A permanent record of the transaction — who paid, how much, when — is written to 0G's decentralised storage. Automatically.
                  </p>
                </div>
              </div>
            </BlurReveal>

            <BlurReveal delay={0.3}>
              <div className="flex flex-col gap-5 group">
                <div className="w-14 h-14 rounded-2xl bg-[var(--color-brand-orange)] text-white flex items-center justify-center shrink-0 font-bold text-xl shadow-[4px_4px_0px_0px_#c73f00] group-hover:scale-110 transition-transform duration-300">
                  3
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2 text-[var(--color-brand-navy)]">Anyone can verify</h3>
                  <p className="text-[var(--color-text-secondary)] leading-relaxed font-medium">
                    The receipt is publicly auditable. Your customer, your auditor, or an AI agent can confirm the payment happened — no intermediary needed.
                  </p>
                </div>
              </div>
            </BlurReveal>
          </div>
        </div>
      </section>

      {/* ─── Why it matters ────────────────────────────────────────────────── */}
      <section className="py-24 bg-[var(--color-brand-navy)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[var(--color-brand-orange)]/10 rounded-full blur-[120px] translate-x-1/3 -translate-y-1/3 pointer-events-none" />

        <div className="container mx-auto px-6 relative z-10">
          <BlurReveal>
            <div className="inline-block mb-4 px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-[var(--color-brand-orange)] tracking-wide uppercase border border-white/10">
              Why it matters
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white tracking-tighter max-w-2xl">
              The internet is getting an upgrade. Payments should too.
            </h2>
            <p className="text-white/60 text-lg leading-relaxed font-medium mb-16 max-w-2xl">
              Subscriptions get cancelled. Chargebacks happen. AI agents need to buy things. 0G gives every Coal payment a permanent, public record that works for all three — without changing how you accept payments today.
            </p>
          </BlurReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Shield,
                title: 'No more chargebacks',
                body: 'The proof is on-chain. Every payment has a public, timestamped record that anyone can audit. Disputes resolve in seconds, not weeks.',
              },
              {
                icon: Global,
                title: 'Payments AI agents can make',
                body: 'The next wave of buyers are AI agents acting on behalf of people. 0G makes your product natively accessible to them — right now.',
              },
              {
                icon: Verify,
                title: 'Identity that outlives your stack',
                body: 'Your merchant history and customer relationships are yours, stored decentrally. Migrate, rebuild, or pivot — your reputation comes with you.',
              },
            ].map(({ icon: Icon, title, body }, i) => (
              <BlurReveal key={title} delay={0.05 + i * 0.08}>
                <div className="p-8 bg-white/6 rounded-[32px] border border-white/10 h-full hover:border-[var(--color-brand-orange)]/50 transition-all duration-300 hover:bg-white/10">
                  <div className="w-12 h-12 rounded-2xl bg-white/8 flex items-center justify-center mb-5 border border-white/10">
                    <Icon size={24} variant="Bold" className="text-[var(--color-brand-orange)]" />
                  </div>
                  <h3 className="text-lg font-bold mb-2 text-white tracking-tight">{title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed font-medium">{body}</p>
                </div>
              </BlurReveal>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
