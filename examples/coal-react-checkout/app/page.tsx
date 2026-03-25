const DEMOS = [
  {
    href: '/checkout',
    emoji: '🛒',
    label: 'Human Checkout',
    tag: 'Redirect flow',
    desc: 'Product selection → session creation → Coal hosted checkout → success redirect. The standard payment flow for web apps.',
    color: '#dbeafe',
    tagColor: '#2563eb',
  },
  {
    href: '/paywall',
    emoji: '🔒',
    label: 'x402 Paywall',
    tag: 'HTTP 402',
    desc: 'Gate any URL or API behind a crypto payment. Returns 402 until proof of payment is submitted. Manifests auto-publish to 0G.',
    color: '#fce7f3',
    tagColor: '#db2777',
  },
  {
    href: '/agent',
    emoji: '🤖',
    label: 'AI Agent Payment',
    tag: 'Autonomous',
    desc: 'Watch an AI agent discover a paywall, create a session, simulate on-chain payment, and verify access — all without human input.',
    color: '#d1fae5',
    tagColor: '#059669',
  },
  {
    href: '/receipt',
    emoji: '🧾',
    label: 'Receipt Verification',
    tag: 'Proof trail',
    desc: 'Verify any payment with a 3-step proof trail: Payment on Base → Receipt on 0G Storage → Anchor on 0G Chain. Public, no auth needed.',
    color: '#ecfdf5',
    tagColor: '#059669',
  },
  {
    href: '/subscription',
    emoji: '🔄',
    label: 'Subscriptions',
    tag: 'Recurring',
    desc: 'Monthly or yearly billing with explicit consent capture. Coal tracks active subscriptions and processes renewals automatically.',
    color: '#ede9fe',
    tagColor: '#7c3aed',
  },
  {
    href: '/splits',
    emoji: '✂️',
    label: 'Revenue Splits',
    tag: 'Multi-wallet',
    desc: 'Define percentage-based split configs once. Coal distributes payment proceeds to multiple wallet addresses at settlement.',
    color: '#fef9c3',
    tagColor: '#ca8a04',
  },
  {
    href: '/receipt',
    emoji: '🧾',
    label: 'Receipt Verification',
    tag: '0G proof trail',
    desc: 'Verify any payment with a 3-step proof trail: Base L2 confirmation, 0G Storage receipt, and 0G Chain anchor. Fully public, no API key needed.',
    color: '#ecfdf5',
    tagColor: '#059669',
  },
  {
    href: '/embed',
    emoji: '🧩',
    label: 'SDK Components',
    tag: 'coal-react',
    desc: '<CoalCheckoutButton /> and useCoalCheckout hook. Drop-in components for any React app with TypeScript support.',
    color: '#ffedd5',
    tagColor: '#ea580c',
  },
  {
    href: '/webhook',
    emoji: '🔔',
    label: 'Webhooks',
    tag: 'Server events',
    desc: 'Receive signed checkout.session.completed events. Live event feed with HMAC-SHA256 signature verification.',
    color: '#e0f2fe',
    tagColor: '#0284c7',
  },
];

const CODE = `// 1. Create session (server)
const res = await fetch('https://api.usecoal.xyz/api/checkouts', {
  method: 'POST',
  headers: { 'x-api-key': process.env.COAL_API_KEY },
  body: JSON.stringify({ amount: 29.99, productName: 'Pro Plan',
    redirectUrl: 'https://yourapp.com/success' }),
});
const { data } = await res.json();

// 2. Redirect user (client)
import { CoalCheckoutButton } from 'coal-react';
<CoalCheckoutButton checkoutUrl={data.url} />`;

export default function HubPage() {
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '48px 24px' }}>

      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '56px' }}>
        <span style={{ display: 'inline-block', background: 'white', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: '999px', padding: '4px 14px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#FF5C16', marginBottom: '20px' }}>
          Demo Kitchen
        </span>
        <h1 style={{ fontSize: 'clamp(2rem,5vw,3.5rem)', fontWeight: 900, color: '#180D43', margin: '0 0 16px', letterSpacing: '-0.04em', lineHeight: 1.1 }}>
          Everything Coal can do.
        </h1>
        <p style={{ color: '#6B7280', fontSize: '16px', maxWidth: '520px', margin: '0 auto 32px', lineHeight: 1.6 }}>
          From a simple product checkout to full AI agent autonomous payments — every feature live and working.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {[
            { icon: '⛓️', text: 'Base network' },
            { icon: '💵', text: 'USDC settlement' },
            { icon: '⚡', text: '~2s confirmation' },
            { icon: '🤖', text: '0G AI-ready' },
            { icon: '🔐', text: 'Sealed inference' },
          ].map(b => (
            <span key={b.text} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'white', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: '999px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, color: '#180D43' }}>
              {b.icon} {b.text}
            </span>
          ))}
        </div>
      </div>

      {/* Demo grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: '16px', marginBottom: '56px' }}>
        {DEMOS.map(demo => (
          <a
            key={demo.href}
            href={demo.href}
            style={{ display: 'block', background: 'white', borderRadius: '24px', border: '2px solid rgba(0,0,0,0.06)', padding: '24px', textDecoration: 'none', transition: 'all 0.2s', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ width: '44px', height: '44px', background: demo.color, borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                {demo.emoji}
              </div>
              <span style={{ background: demo.color, color: demo.tagColor, fontSize: '10px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '6px' }}>
                {demo.tag}
              </span>
            </div>
            <p style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 900, color: '#180D43', letterSpacing: '-0.02em' }}>{demo.label}</p>
            <p style={{ margin: 0, fontSize: '13px', color: '#6B7280', lineHeight: 1.55 }}>{demo.desc}</p>
          </a>
        ))}
      </div>

      {/* Quick start */}
      <div style={{ background: '#180D43', borderRadius: '28px', padding: '32px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '32px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: '240px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Quick Start</p>
            <h2 style={{ margin: '0 0 12px', fontSize: '1.5rem', fontWeight: 900, color: 'white', letterSpacing: '-0.03em' }}>Two steps to payments</h2>
            <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              Install coal-react, create a session server-side, redirect with the button.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { key: 'COAL_API_KEY', val: 'coal_live_...' },
                { key: 'COAL_API_URL', val: 'https://api.usecoal.xyz' },
                { key: 'NEXT_PUBLIC_COAL_BASE_URL', val: 'https://www.usecoal.xyz' },
              ].map(e => (
                <div key={e.key} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px 14px', fontFamily: 'monospace', fontSize: '11px' }}>
                  <span style={{ color: '#FF5C16' }}>{e.key}</span>
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>=</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>{e.val}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: '1 1 320px' }}>
            <pre style={{ margin: 0, background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '20px', fontSize: '11px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.75)', lineHeight: 1.75, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {CODE}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
