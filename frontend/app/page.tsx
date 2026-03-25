import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import BlurReveal from "@/components/BlurReveal";
import CodeBlock from "@/components/CodeBlock";
import LandingTokenRow from "@/components/LandingTokenRow";
import {
  Lock,
  Flash,
  Card,
  Hierarchy,
  Link21,
  Notification,
  Code1,
} from "iconsax-reactjs";

// ─── Feature card ────────────────────────────────────────────────────────────

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

// ─── Pricing table cell ───────────────────────────────────────────────────────

function PricingCell({
  value,
  highlight = false,
}: {
  value: string;
  highlight?: boolean;
}) {
  return (
    <td
      className={`px-4 py-4 text-sm font-semibold text-center ${
        highlight
          ? "text-[var(--color-brand-navy)] bg-[var(--color-brand-orange)]/8"
          : "text-[var(--color-text-secondary)]"
      }`}
    >
      {value}
    </td>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const curlSnippet = `curl -X POST https://api.usecoal.xyz/api/checkouts \\
  -H "x-api-key: coal_live_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{ "amount": 49.99, "productName": "Pro Plan" }'

# Response
# {
#   "id": "chk_abc123",
#   "checkoutUrl": "https://usecoal.xyz/pay/checkout/chk_abc123"
# }`;

  return (
    <main className="min-h-screen">
      <Navbar />

      <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(255,92,22,0.16),transparent_30%),radial-gradient(circle_at_left_35%,rgba(67,98,209,0.14),transparent_26%),linear-gradient(180deg,#f8f5ef_0%,#f5f2ed_55%,#f5f2ed_100%)]">
        <Hero />

        <section className="relative -mt-2 pb-20 md:-mt-6 md:pb-24">
          <div className="container mx-auto px-6">
            <BlurReveal>
              <div className="mx-auto flex max-w-5xl flex-col items-center gap-8">
                <p className="text-center text-sm font-bold uppercase tracking-[0.22em] text-[var(--color-text-secondary)]">
                  Accept payments in
                </p>
                <LandingTokenRow />
              </div>
            </BlurReveal>
          </div>
        </section>
      </div>

      <section id="how-it-works" className="py-24 bg-[var(--color-bg-base)]">
        <div className="container mx-auto px-6">
          <BlurReveal>
            <div className="inline-block mb-4 px-3 py-1 rounded-full bg-white text-xs font-bold text-[var(--color-brand-orange)] tracking-wide uppercase border border-black/8">
              The Flow
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-16 text-[var(--color-brand-navy)] tracking-tighter max-w-xl">
              Up and running in 3 steps
            </h2>
          </BlurReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <BlurReveal delay={0.1}>
              <div className="flex flex-col gap-5 group">
                <div className="w-14 h-14 rounded-2xl bg-[var(--color-brand-navy)] text-white flex items-center justify-center shrink-0 font-bold text-xl shadow-[4px_4px_0px_0px_var(--color-brand-orange)] group-hover:scale-110 transition-transform duration-300">
                  1
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2 text-[var(--color-brand-navy)]">
                    Create a payment link
                  </h3>
                  <p className="text-[var(--color-text-secondary)] leading-relaxed font-medium">
                    Set up your product in the console. Name it, set the amount, choose your settlement wallet — done in seconds.
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
                  <h3 className="text-xl font-bold mb-2 text-[var(--color-brand-navy)]">
                    Customer pays with supported tokens
                  </h3>
                  <p className="text-[var(--color-text-secondary)] leading-relaxed font-medium">
                    Your customer connects their wallet or pays with a card. Routing moves supported assets into your chosen settlement path on Base.
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
                  <h3 className="text-xl font-bold mb-2 text-[var(--color-brand-navy)]">
                    Funds arrive in your wallet
                  </h3>
                  <p className="text-[var(--color-text-secondary)] leading-relaxed font-medium">
                    Settlement lands on-chain in ~2 seconds. A signed webhook fires immediately so your backend can fulfil the order.
                  </p>
                </div>
              </div>
            </BlurReveal>
          </div>
        </div>
      </section>

      <section id="features" className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <BlurReveal>
            <div className="inline-block mb-4 px-3 py-1 rounded-full bg-[var(--color-bg-base)] text-xs font-bold text-[var(--color-brand-orange)] tracking-wide uppercase">
              Why Coal
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-16 text-[var(--color-brand-navy)] tracking-tighter max-w-xl">
              Everything you need, nothing you don't
            </h2>
          </BlurReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={Lock}
              title="Non-custodial"
              description="Funds flow directly to your wallet. Coal never holds them — no escrow, no counterparty risk, no waiting."
              delay={0.05}
            />
            <FeatureCard
              icon={Flash}
              title="Flexible token routing"
              description="Route supported ERC-20 payments into your preferred settlement asset on Base without forcing a custom payment flow."
              delay={0.1}
            />
            <FeatureCard
              icon={Card}
              title="Pay with card"
              description="MoonPay on-ramp is built in. Customers who don't have crypto can still pay with Visa or Mastercard."
              delay={0.15}
            />
            <FeatureCard
              icon={Notification}
              title="Webhook events"
              description="Every payment fires a signed webhook so your backend can fulfil orders, update databases, or trigger workflows in real time."
              delay={0.2}
            />
            <FeatureCard
              icon={Hierarchy}
              title="Revenue splits"
              description="Configure automatic multi-party payouts once. Funds split instantly between platform, creator, partner, and DAO."
              delay={0.25}
            />
            <FeatureCard
              icon={Code1}
              title="x402 Paywalls"
              description="Gate any HTTP resource with a single response header. Charge per-request without building a full checkout flow."
              delay={0.3}
            />
          </div>
        </div>
      </section>

      <section id="pricing" className="py-24 bg-[var(--color-bg-base)]">
        <div className="container mx-auto px-6">

          {/* Header */}
          <BlurReveal>
            <div className="inline-block mb-4 px-3 py-1 rounded-full bg-white text-xs font-bold text-[var(--color-brand-orange)] tracking-wide uppercase border border-black/8">
              Pricing
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-[var(--color-brand-navy)] tracking-tighter">
              Stripe charges 2.9%.<br />Coal doesn't.
            </h2>
            <p className="text-[var(--color-text-secondary)] text-lg font-medium mb-16 max-w-xl">
              No transaction fees. Ever. You only pay gas — less than $0.01 per payment on Base.
            </p>
          </BlurReveal>

          {/* Plan cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">

            {/* Starter */}
            <BlurReveal delay={0.05}>
              <div className="flex flex-col p-8 rounded-[32px] bg-white border-2 border-black/8 h-full hover:border-black/20 transition-all">
                <div className="mb-6">
                  <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-widest mb-2">Starter</p>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-5xl font-black text-[var(--color-brand-navy)] tracking-tighter">Free</span>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] font-medium">Forever. No credit card required.</p>
                </div>
                <ul className="flex flex-col gap-3 mb-8 flex-1">
                  {[
                    "Unlimited payment links",
                    "Unlimited checkout sessions",
                    "Webhook notifications",
                    "USDC or configured settlement token",
                    "MoonPay card payments",
                    "1 team seat",
                    "Community support",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm font-medium text-[var(--color-brand-navy)]">
                      <span className="w-4 h-4 rounded-full bg-[var(--color-bg-base)] border border-black/10 flex items-center justify-center shrink-0 text-[10px] text-[var(--color-brand-navy)] font-black">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a href="/signup" className="mt-auto block text-center py-3 px-6 rounded-full border-2 border-[var(--color-brand-navy)] font-bold text-sm text-[var(--color-brand-navy)] hover:bg-[var(--color-brand-navy)] hover:text-white transition-all">
                  Get started free
                </a>
              </div>
            </BlurReveal>

            {/* Pro — highlighted, coming soon */}
            <BlurReveal delay={0.1}>
              <div className="flex flex-col p-8 rounded-[32px] bg-[var(--color-brand-navy)] border-2 border-[var(--color-brand-navy)] shadow-[6px_6px_0px_0px_var(--color-brand-orange)] h-full relative opacity-90">
                <div className="absolute top-6 right-6 flex flex-col items-end gap-1.5">
                  <span className="px-3 py-1 rounded-full bg-[var(--color-brand-orange)] text-white text-[10px] font-black uppercase tracking-wider">Coming soon</span>
                </div>
                <div className="mb-6">
                  <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Pro</p>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-5xl font-black text-white tracking-tighter">$29</span>
                    <span className="text-white/50 font-medium">/month</span>
                  </div>
                  <p className="text-sm text-white/50 font-medium">Billed monthly. Cancel anytime.</p>
                </div>
                <ul className="flex flex-col gap-3 mb-8 flex-1">
                  {[
                    "Everything in Starter",
                    "Revenue splits",
                    "x402 HTTP paywalls",
                    "Advanced analytics + CSV export",
                    "Up to 5 team seats",
                    "Priority email support",
                    "Higher API rate limits",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm font-medium text-white/75">
                      <span className="w-4 h-4 rounded-full bg-[var(--color-brand-orange)]/20 border border-[var(--color-brand-orange)]/40 flex items-center justify-center shrink-0 text-[10px] text-[var(--color-brand-orange)] font-black">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button disabled className="mt-auto block w-full text-center py-3 px-6 rounded-full bg-white/10 border-2 border-white/20 font-bold text-sm text-white/40 cursor-not-allowed">
                  Coming soon
                </button>
              </div>
            </BlurReveal>

            {/* Enterprise — coming soon */}
            <BlurReveal delay={0.15}>
              <div className="flex flex-col p-8 rounded-[32px] bg-white border-2 border-black/8 h-full relative opacity-75">
                <div className="absolute top-6 right-6">
                  <span className="px-3 py-1 rounded-full bg-black/5 text-[var(--color-text-secondary)] text-[10px] font-black uppercase tracking-wider border border-black/8">Coming soon</span>
                </div>
                <div className="mb-6">
                  <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-widest mb-2">Enterprise</p>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-5xl font-black text-[var(--color-brand-navy)] tracking-tighter">Custom</span>
                  </div>
                  <p className="text-sm text-[var(--color-text-secondary)] font-medium">Volume pricing. Dedicated SLA.</p>
                </div>
                <ul className="flex flex-col gap-3 mb-8 flex-1">
                  {[
                    "Everything in Pro",
                    "Unlimited team seats",
                    "White-label checkout",
                    "Configured settlement tokens",
                    "99.9% uptime SLA",
                    "Dedicated support channel",
                    "Volume discounts",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm font-medium text-[var(--color-text-secondary)]">
                      <span className="w-4 h-4 rounded-full bg-[var(--color-bg-base)] border border-black/10 flex items-center justify-center shrink-0 text-[10px] text-[var(--color-text-secondary)] font-black">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button disabled className="mt-auto block w-full text-center py-3 px-6 rounded-full border-2 border-black/10 font-bold text-sm text-[var(--color-text-secondary)] cursor-not-allowed">
                  Coming soon
                </button>
              </div>
            </BlurReveal>
          </div>

          {/* Gas fee callout */}
          <BlurReveal delay={0.2}>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-[20px] border-2 border-black/8 px-8 py-5 mb-16">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⛽</span>
                <div>
                  <p className="font-bold text-[var(--color-brand-navy)] text-sm">Gas fees only — no platform cut</p>
                  <p className="text-xs text-[var(--color-text-secondary)] font-medium">Every plan pays &lt;$0.01 in Base gas per transaction. Coal takes 0%.</p>
                </div>
              </div>
              <span className="shrink-0 px-4 py-1.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-black uppercase tracking-wide">0% fees</span>
            </div>
          </BlurReveal>

          {/* Comparison table */}
          <BlurReveal delay={0.25}>
            <p className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-widest mb-6">vs. the alternatives</p>
            <div className="overflow-x-auto rounded-[28px] border-2 border-black/8 bg-white shadow-sm">
              <table className="w-full min-w-[560px] text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-black/8">
                    <th className="px-4 py-4 text-sm font-bold text-[var(--color-text-secondary)] w-1/4"></th>
                    <th className="px-4 py-4 text-sm font-black text-center text-[var(--color-brand-navy)] bg-[var(--color-brand-orange)]/8">Coal</th>
                    <th className="px-4 py-4 text-sm font-bold text-center text-[var(--color-text-secondary)]">Stripe</th>
                    <th className="px-4 py-4 text-sm font-bold text-center text-[var(--color-text-secondary)]">Traditional Crypto</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-black/5">
                    <td className="px-4 py-4 text-sm font-bold text-[var(--color-brand-navy)]">Transaction fee</td>
                    <PricingCell value="&lt;$0.01 gas" highlight />
                    <PricingCell value="2.9% + 30¢" />
                    <PricingCell value="Variable" />
                  </tr>
                  <tr className="border-b border-black/5">
                    <td className="px-4 py-4 text-sm font-bold text-[var(--color-brand-navy)]">Settlement time</td>
                    <PricingCell value="~2 seconds" highlight />
                    <PricingCell value="2–7 days" />
                    <PricingCell value="Minutes–hours" />
                  </tr>
                  <tr className="border-b border-black/5">
                    <td className="px-4 py-4 text-sm font-bold text-[var(--color-brand-navy)]">Custodial</td>
                    <PricingCell value="No" highlight />
                    <PricingCell value="Yes" />
                    <PricingCell value="Yes (exchanges)" />
                  </tr>
                  <tr>
                    <td className="px-4 py-4 text-sm font-bold text-[var(--color-brand-navy)]">Code integration</td>
                    <PricingCell value="5 lines" highlight />
                    <PricingCell value="~50 lines" />
                    <PricingCell value="Complex" />
                  </tr>
                </tbody>
              </table>
            </div>
          </BlurReveal>

        </div>
      </section>

      <section className="py-24 bg-[var(--color-brand-navy)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[var(--color-brand-orange)]/10 rounded-full blur-[120px] translate-x-1/3 -translate-y-1/3 pointer-events-none" />

        <div className="container mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row items-start gap-16">
            <div className="lg:w-2/5">
              <BlurReveal>
                <div className="inline-block mb-4 px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-[var(--color-brand-orange)] tracking-wide uppercase border border-white/10">
                  Integration
                </div>
                <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white tracking-tighter">
                  One API call.<br />That's it.
                </h2>
                <p className="text-white/60 text-lg leading-relaxed font-medium mb-8">
                  POST one endpoint. Get back a hosted checkout URL. Redirect your customer.
                  Webhooks are available when you need fulfillment hooks, and you can skip SDKs at launch.
                </p>
                <div className="flex items-center gap-4">
                  <Link21 size={20} variant="Bold" className="text-[var(--color-brand-orange)] shrink-0" />
                  <a
                    href="/docs"
                    className="text-white/80 hover:text-white font-bold underline underline-offset-4 transition-colors"
                  >
                    Read the full API docs →
                  </a>
                </div>
              </BlurReveal>
            </div>

            <div className="lg:w-3/5 w-full">
              <BlurReveal delay={0.2}>
                <CodeBlock className="language-bash">
                  {curlSnippet}
                </CodeBlock>
              </BlurReveal>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
