import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import FeatureSection, { FeatureCard } from "@/components/FeatureSection";
import CodeBlock from "@/components/CodeBlock";
import BlurReveal from "@/components/BlurReveal";
import {
  Code1,
  Judge,
  Flash,
  Lock,
  Card,
  Hierarchy,
  EmptyWallet,
  SecuritySafe
} from "iconsax-reactjs";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navbar />

      <Hero />

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="lg:w-1/2">
              <BlurReveal>
                <div className="inline-block mb-4 px-3 py-1 rounded-full bg-[var(--color-bg-base)] text-xs font-bold text-[var(--color-brand-orange)] tracking-wide uppercase">
                  The Flow
                </div>
                <h2 className="text-4xl md:text-5xl font-bold mb-8 text-[var(--color-brand-navy)] tracking-tighter">
                  How Coal Works
                </h2>
              </BlurReveal>
              <div className="space-y-10">
                <BlurReveal delay={0.1}>
                  <div className="flex gap-6 group">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--color-brand-navy)] text-white flex items-center justify-center shrink-0 font-bold text-xl shadow-lg group-hover:scale-110 transition-transform duration-300">1</div>
                    <div>
                      <h3 className="text-2xl font-bold mb-2 text-[var(--color-brand-navy)]">Create a Checkout</h3>
                      <p className="text-[var(--color-text-secondary)] text-lg leading-relaxed">
                        Your app calls <code className="bg-gray-100 px-1 py-0.5 rounded text-sm text-pink-600 font-mono">POST /api/checkout</code>.
                        Coal creates a session and returns a payment URL.
                      </p>
                    </div>
                  </div>
                </BlurReveal>
                <BlurReveal delay={0.2}>
                  <div className="flex gap-6 group">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--color-bg-base)] border-2 border-[var(--color-brand-navy)] text-[var(--color-brand-navy)] flex items-center justify-center shrink-0 font-bold text-xl group-hover:rotate-6 transition-transform duration-300">2</div>
                    <div>
                      <h3 className="text-2xl font-bold mb-2 text-[var(--color-brand-navy)]">User Pays with MNEE</h3>
                      <p className="text-[var(--color-text-secondary)] text-lg leading-relaxed">
                        The user sees a simple payment UI and pays with their MNEE wallet.
                        Coal tracks the transaction.
                      </p>
                    </div>
                  </div>
                </BlurReveal>
                <BlurReveal delay={0.3}>
                  <div className="flex gap-6 group">
                    <div className="w-14 h-14 rounded-2xl bg-[var(--color-brand-orange)] text-white flex items-center justify-center shrink-0 font-bold text-xl shadow-md group-hover:-translate-y-2 transition-transform duration-300">3</div>
                    <div>
                      <h3 className="text-2xl font-bold mb-2 text-[var(--color-brand-navy)]">Instant Split & Settle</h3>
                      <p className="text-[var(--color-text-secondary)] text-lg leading-relaxed">
                        Coal triggers the MNEE transfer, automatically splitting funds to all recipients.
                        You get a webhook when it's done.
                      </p>
                    </div>
                  </div>
                </BlurReveal>
              </div>
            </div>
            <div className="lg:w-1/2 w-full">
              <BlurReveal delay={0.2} xOffset={20}>
                <CodeBlock />
              </BlurReveal>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem Section */}
      <FeatureSection title="The Problem" id="features">
        <FeatureCard
          icon={Code1}
          title="Custom Contracts"
          description="Apps today must write custom smart contracts for every new integration, introducing security risks and delay."
          className="rotate-[-2deg] md:translate-y-4"
          delay={0.1}
        />
        <FeatureCard
          icon={Judge}
          title="Manual Splits"
          description="Handling payment splitting manually is error-prone and requires complex reconciliation logic."
          className="rotate-[3deg] z-10"
          delay={0.2}
        />
        <FeatureCard
          icon={Flash}
          title="Slow Integration"
          description="Rebuilding checkout logic for every app slows teams down and breaks the payment experience."
          className="rotate-[-4deg] md:translate-y-8"
          delay={0.3}
        />
      </FeatureSection>

      {/* What You Can Build Section */}
      <section className="py-32 bg-[var(--color-brand-navy)] text-white relative overflow-hidden">

        <div className="container mx-auto px-6 relative z-10">
          <BlurReveal>
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 tracking-tighter">
              What You Can Build With Coal
            </h2>
          </BlurReveal>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <BlurReveal delay={0.1} className="h-full">
              <div className="p-10 rounded-[40px] bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all duration-300 group h-full">
                <div className="w-16 h-16 rounded-2xl bg-[var(--color-brand-orange)] flex items-center justify-center mb-6 border-2 border-[var(--color-brand-navy)] shadow-[4px_4px_0px_0px_#180D43] group-hover:rotate-6 transition-transform duration-300">
                  <Card size={32} className="text-white" variant="Bold" />
                </div>
                <h3 className="text-2xl font-bold mb-3 tracking-tight text-white">In-App Checkouts</h3>
                <p className="text-white/60 leading-relaxed font-medium">Sell digital goods, credits, or features inside your app seamlessly.</p>
              </div>
            </BlurReveal>

            <BlurReveal delay={0.2} className="h-full">
              <div className="p-10 rounded-[40px] bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all duration-300 group h-full">
                <div className="w-16 h-16 rounded-2xl bg-[var(--color-brand-orange)] flex items-center justify-center mb-6 border-2 border-[var(--color-brand-navy)] shadow-[4px_4px_0px_0px_#180D43] group-hover:rotate-6 transition-transform duration-300">
                  <Lock size={32} className="text-white" variant="Bold" />
                </div>
                <h3 className="text-2xl font-bold mb-3 tracking-tight text-white">Paywalls</h3>
                <p className="text-white/60 leading-relaxed font-medium">Lock content or APIs behind MNEE payments tailored to your needs.</p>
              </div>
            </BlurReveal>

            <BlurReveal delay={0.3} className="h-full">
              <div className="p-10 rounded-[40px] bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all duration-300 group h-full">
                <div className="w-16 h-16 rounded-2xl bg-[var(--color-brand-orange)] flex items-center justify-center mb-6 border-2 border-[var(--color-brand-navy)] shadow-[4px_4px_0px_0px_#180D43] group-hover:rotate-6 transition-transform duration-300">
                  <Hierarchy size={32} className="text-white" variant="Bold" />
                </div>
                <h3 className="text-2xl font-bold mb-3 tracking-tight text-white">Revenue Splits</h3>
                <p className="text-white/60 leading-relaxed font-medium">Automatically split payments between Platform, Creator, Partner, and DAO.</p>
              </div>
            </BlurReveal>

            <BlurReveal delay={0.4} className="h-full">
              <div className="p-10 rounded-[40px] bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-all duration-300 group h-full">
                <div className="w-16 h-16 rounded-2xl bg-[var(--color-brand-orange)] flex items-center justify-center mb-6 border-2 border-[var(--color-brand-navy)] shadow-[4px_4px_0px_0px_#180D43] group-hover:rotate-6 transition-transform duration-300">
                  <EmptyWallet size={32} className="text-white" variant="Bold" />
                </div>
                <h3 className="text-2xl font-bold mb-3 tracking-tight text-white">Simple Payouts</h3>
                <p className="text-white/60 leading-relaxed font-medium">Send funds directly to settlement wallets. No checking, no custody risk.</p>
              </div>
            </BlurReveal>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-24">
        <div className="container mx-auto px-6 text-center max-w-4xl">
          <BlurReveal>
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white text-[var(--color-brand-orange)] mb-10 border-2 border-[var(--color-brand-navy)] shadow-[6px_6px_0px_0px_#180D43] rotate-3 hover:rotate-6 transition-transform">
              <SecuritySafe size={42} variant="Bold" />
            </div>
            <h2 className="text-4xl font-bold mb-6 text-[var(--color-brand-navy)] tracking-tighter">
              Security & Trust
            </h2>
            <p className="text-xl text-[var(--color-text-secondary)] mb-16 max-w-2xl mx-auto">
              Coal never holds user funds. Payments settle directly on-chain.
              Merchants remain in full control. Built on audited smart contracts.
            </p>
          </BlurReveal>

          <BlurReveal delay={0.2}>
            <div className="bg-white rounded-[40px] border-2 border-black/5 p-10 md:p-14">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-left">
                <div className="group">
                  <div className="w-12 h-1 bg-[var(--color-brand-orange)] mb-6 rounded-full group-hover:w-20 transition-all"></div>
                  <h4 className="font-bold text-2xl mb-2 text-[var(--color-brand-navy)] tracking-tight">Non-Custodial</h4>
                  <p className="text-[var(--color-text-secondary)] font-medium">No middleman wallet.</p>
                </div>
                <div className="group">
                  <div className="w-12 h-1 bg-[var(--color-brand-blue)] mb-6 rounded-full group-hover:w-20 transition-all"></div>
                  <h4 className="font-bold text-2xl mb-2 text-[var(--color-brand-navy)] tracking-tight">On-Chain</h4>
                  <p className="text-[var(--color-text-secondary)] font-medium">Verifiable transactions.</p>
                </div>
                <div className="group">
                  <div className="w-12 h-1 bg-[#22c55e] mb-6 rounded-full group-hover:w-20 transition-all"></div>
                  <h4 className="font-bold text-2xl mb-2 text-[var(--color-brand-navy)] tracking-tight">Instant</h4>
                  <p className="text-[var(--color-text-secondary)] font-medium">No settlement delays.</p>
                </div>
              </div>
            </div>
          </BlurReveal>
        </div>
      </section>

      <Footer />
    </main>
  );
}
