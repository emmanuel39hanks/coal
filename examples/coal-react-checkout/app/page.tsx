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
    label: 'Agent-Payable Content',
    tag: 'x402',
    desc: 'Gate any resource with HTTP 402. AI agents discover it on 0G, read pricing from x402 headers, and pay autonomously with USDC.',
    color: '#fce7f3',
    tagColor: '#db2777',
  },
  {
    href: '/agent',
    emoji: '🤖',
    label: 'Autonomous Agent',
    tag: 'Real payments',
    desc: 'AI agent with its own wallet discovers merchants, pays with real USDC on Base, and verifies receipts — zero human interaction.',
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
  {
    href: '/bring-your-own-catalog',
    emoji: '📇',
    label: 'Bring Your Own Catalog',
    tag: 'Indexing',
    desc: 'Drop <CoalAgentPublisher> on your site and your existing product catalog gets indexed on 0G Storage + KV for live agent discovery. Zero migration.',
    color: '#fce7f3',
    tagColor: '#db2777',
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
    <div className="page-container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '48px 24px' }}>

      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <span style={{ display: 'inline-block', background: 'white', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: '999px', padding: '4px 14px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#FF5C16', marginBottom: '16px' }}>
          Demo Kitchen
        </span>
        <h1 className="page-title" style={{ fontSize: 'clamp(1.75rem,5vw,3.5rem)', fontWeight: 900, color: '#180D43', margin: '0 0 12px', letterSpacing: '-0.04em', lineHeight: 1.1 }}>
          Everything Coal can do.
        </h1>
        <p style={{ color: '#6B7280', fontSize: '14px', maxWidth: '520px', margin: '0 auto 24px', lineHeight: 1.6 }}>
          From a simple product checkout to full AI agent autonomous payments — every feature live and working.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { icon: '⛓️', text: 'Base network' },
            { icon: '💵', text: 'USDC settlement' },
            { icon: '⚡', text: '~2s confirmation' },
            { icon: '🤖', text: '0G AI-ready' },
            { icon: '🔐', text: 'Sealed inference' },
          ].map(b => (
            <span key={b.text} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'white', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: '999px', padding: '5px 10px', fontSize: '11px', fontWeight: 700, color: '#180D43' }}>
              {b.icon} {b.text}
            </span>
          ))}
        </div>
      </div>

      {/* Demo grid */}
      <div className="demo-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: '12px', marginBottom: '40px' }}>
        {DEMOS.map(demo => (
          <a
            key={demo.href + demo.tag}
            href={demo.href}
            style={{ display: 'block', background: 'white', borderRadius: '20px', border: '2px solid rgba(0,0,0,0.06)', padding: '20px', textDecoration: 'none', transition: 'all 0.2s', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ width: '40px', height: '40px', background: demo.color, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                {demo.emoji}
              </div>
              <span style={{ background: demo.color, color: demo.tagColor, fontSize: '9px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '6px', flexShrink: 0 }}>
                {demo.tag}
              </span>
            </div>
            <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 900, color: '#180D43', letterSpacing: '-0.02em' }}>{demo.label}</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#6B7280', lineHeight: 1.55 }}>{demo.desc}</p>
          </a>
        ))}
      </div>

      {/* Quick start */}
      <div style={{ background: '#180D43', borderRadius: '24px', padding: '24px', overflow: 'hidden' }}>
        <div className="grid-stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'flex-start' }}>
          <div>
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
