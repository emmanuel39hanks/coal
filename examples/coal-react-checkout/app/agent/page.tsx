const STEPS = [
  { n: 1, title: 'Discover', desc: 'Agent finds merchants on 0G Storage — browsing decentralized profiles, products, and pricing.' },
  { n: 2, title: 'Pay', desc: 'Agent sends real USDC on Base from its own wallet. No human clicks, no browser popups.' },
  { n: 3, title: 'Verify', desc: 'Coal confirms on-chain, publishes receipt to 0G Storage, anchors hash on 0G Chain.' },
  { n: 4, title: 'Receipt', desc: '3-step proof trail: Base TX → 0G Storage → 0G Chain. Tamper-proof and publicly verifiable.' },
];

const CODE = `// Agent tool: execute_payment
// Sends real USDC on Base via Privy server wallet
{
  name: 'execute_payment',
  description: 'Autonomously pay for a checkout using the agent wallet. Sends real USDC on Base.',
  parameters: {
    sessionId: 'checkout session ID',
    amount: 'USD amount (max $5.00)',
    recipient: 'merchant payout address',
    purpose: 'paywall | checkout',
  }
}`;

export default function AgentPage() {
  return (
    <div className="page-container" style={{ maxWidth: '860px', margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <span style={{ display: 'inline-block', background: 'white', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: '999px', padding: '4px 14px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#FF5C16', marginBottom: '16px' }}>
          Autonomous Agent
        </span>
        <h1 className="page-title" style={{ fontSize: 'clamp(1.75rem,5vw,2.5rem)', fontWeight: 900, color: '#180D43', margin: '0 0 12px', letterSpacing: '-0.04em', lineHeight: 1.1 }}>
          AI agents that pay with real crypto.
        </h1>
        <p style={{ color: '#6B7280', fontSize: '15px', maxWidth: '520px', margin: '0 auto 28px', lineHeight: 1.6 }}>
          Watch an AI agent discover merchants on 0G, evaluate products, pay with USDC on Base, and verify receipts — all without human interaction.
        </p>
        <a
          href="https://agent.usecoal.xyz"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#000', color: 'white', borderRadius: '999px', padding: '15px 40px', fontSize: '15px', fontWeight: 700, textDecoration: 'none', boxShadow: '6px 6px 0 0 #FF5C16', transition: 'all 0.15s' }}
        >
          Open Live Agent Demo →
        </a>
      </div>

      {/* How it works */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '40px' }}>
        {STEPS.map(step => (
          <div key={step.n} style={{ background: 'white', borderRadius: '20px', border: '2px solid rgba(0,0,0,0.06)', padding: '24px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#FF5C16', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 900, marginBottom: '14px' }}>
              {step.n}
            </div>
            <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 900, color: '#180D43' }}>{step.title}</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#6B7280', lineHeight: 1.55 }}>{step.desc}</p>
          </div>
        ))}
      </div>

      {/* Agent capabilities */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '32px' }}>
        {['0G Storage Discovery', '0G Compute Inference', '0G Chain Anchoring', 'Sealed Inference (TEE)', 'x402 Paywalls', 'Privy Server Wallet'].map(cap => (
          <span key={cap} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'white', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: '999px', padding: '5px 12px', fontSize: '11px', fontWeight: 700, color: '#180D43' }}>
            {cap}
          </span>
        ))}
      </div>

      {/* Code */}
      <div className="code-block" style={{ background: '#180D43', borderRadius: '24px', padding: '24px', overflow: 'hidden' }}>
        <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Agent Tool Definition</p>
        <p style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 700, color: 'white' }}>Real USDC payments via OpenAI function calling</p>
        <pre style={{ margin: 0, background: 'rgba(255,255,255,0.05)', borderRadius: '16px', padding: '20px', fontSize: '11px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.75)', lineHeight: 1.75, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {CODE}
        </pre>
      </div>
    </div>
  );
}
