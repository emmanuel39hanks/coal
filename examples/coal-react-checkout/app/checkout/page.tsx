'use client';

import { useState, useCallback } from 'react';

const PLANS = [
  {
    id: 'starter', name: 'Starter', price: 9.99, period: 'one-time',
    desc: 'For indie developers',
    features: ['5 payment links', 'Webhook notifications', 'Email support'],
    highlight: false,
  },
  {
    id: 'pro', name: 'Pro', price: 29.99, period: 'one-time',
    desc: 'For growing teams',
    features: ['Unlimited links', 'Revenue splits', 'Priority support', 'Analytics'],
    highlight: true,
  },
  {
    id: 'lifetime', name: 'Lifetime', price: 199.00, period: 'once',
    desc: 'Yours forever',
    features: ['Everything in Pro', 'All future features', 'Dedicated onboarding'],
    highlight: false,
  },
];

export default function CheckoutPage() {
  const [selected, setSelected] = useState(PLANS[1]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState<{ sessionId: string; checkoutUrl: string } | null>(null);

  const handleCreate = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: selected.price,
          productName: selected.name + ' Plan',
          productDescription: selected.desc,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.sessionId) throw new Error(data.error || 'Failed to create session');
      setSession({ sessionId: data.sessionId, checkoutUrl: data.checkoutUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [selected]);

  const handlePay = () => {
    if (session?.checkoutUrl) window.location.href = session.checkoutUrl;
  };

  return (
    <div className="page-container" style={{ maxWidth: '860px', margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <span style={{ display: 'inline-block', background: 'white', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: '999px', padding: '4px 14px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#FF5C16', marginBottom: '16px' }}>
          Human checkout
        </span>
        <h1 className="page-title" style={{ fontSize: '2.5rem', fontWeight: 900, color: '#180D43', margin: '0 0 10px', letterSpacing: '-0.04em' }}>Choose a plan</h1>
        <p style={{ color: '#6B7280', fontSize: '15px', margin: 0 }}>
          Select a plan → create session server-side → redirect to Coal checkout → success
        </p>
      </div>

      {/* Flow steps */}
      <div className="flow-steps" style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '36px', flexWrap: 'wrap' }}>
        {[
          { n: 1, label: 'Select plan', done: true },
          { n: 2, label: 'Create session', done: !!session },
          { n: 3, label: 'Coal checkout', done: false },
          { n: 4, label: 'Success redirect', done: false },
        ].map((step) => (
          <div key={step.n} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: step.done ? '#FF5C16' : session && step.n === 2 ? '#FF5C16' : 'rgba(0,0,0,0.1)', color: step.done ? 'white' : '#6B7280', fontSize: '10px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {step.n}
            </div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: step.done ? '#180D43' : '#9CA3AF' }}>{step.label}</span>
            {step.n < 4 && <span className="flow-step-arrow" style={{ color: '#D1D5DB', fontSize: '14px' }}>→</span>}
          </div>
        ))}
      </div>

      {/* Plan cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '16px', marginBottom: '32px' }}>
        {PLANS.map(plan => {
          const isSelected = selected.id === plan.id;
          return (
            <button
              key={plan.id}
              onClick={() => { setSelected(plan); setSession(null); }}
              style={{
                background: plan.highlight ? '#180D43' : 'white',
                border: `2px solid ${isSelected ? '#FF5C16' : 'rgba(0,0,0,0.08)'}`,
                borderRadius: '24px', padding: '24px', textAlign: 'left', cursor: 'pointer',
                boxShadow: isSelected ? '4px 4px 0 0 #FF5C16' : 'none',
                transition: 'all 0.2s', position: 'relative',
              }}
            >
              {plan.highlight && (
                <span style={{ position: 'absolute', top: '14px', right: '14px', background: '#FF5C16', color: 'white', borderRadius: '999px', padding: '2px 10px', fontSize: '9px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Popular</span>
              )}
              <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', color: plan.highlight ? 'rgba(255,255,255,0.45)' : '#9CA3AF' }}>{plan.name}</p>
              <p style={{ margin: '0 0 2px', fontSize: '2.25rem', fontWeight: 900, color: plan.highlight ? 'white' : '#180D43', letterSpacing: '-0.04em' }}>${plan.price.toFixed(2)}</p>
              <p style={{ margin: '0 0 20px', fontSize: '12px', color: plan.highlight ? 'rgba(255,255,255,0.45)' : '#9CA3AF' }}>{plan.desc}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 600, color: plan.highlight ? 'rgba(255,255,255,0.75)' : '#374151' }}>
                    <span style={{ width: '15px', height: '15px', borderRadius: '50%', background: plan.highlight ? 'rgba(255,92,22,0.25)' : '#f5f2ed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#FF5C16', flexShrink: 0 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {/* CTA / Session info */}
      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #fecaca', borderRadius: '16px', padding: '14px 18px', marginBottom: '16px', fontSize: '13px', color: '#dc2626', fontFamily: 'monospace' }}>
          {error}
        </div>
      )}

      {!session ? (
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={handleCreate}
            disabled={loading}
            style={{ background: '#000', color: 'white', border: 'none', borderRadius: '999px', padding: '15px 48px', fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '6px 6px 0 0 #FF5C16', transition: 'all 0.15s', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Creating session…' : `Pay $${selected.price.toFixed(2)} with crypto →`}
          </button>
          <p style={{ marginTop: '12px', fontSize: '11px', color: '#9CA3AF' }}>
            Non-custodial · Funds go directly to merchant · ~2s confirmation on Base
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: '#f0fdf4', border: '2px solid #86efac', borderRadius: '16px', padding: '16px 24px', width: '100%', maxWidth: '520px' }}>
            <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 900, color: '#166534', letterSpacing: '0.1em', textTransform: 'uppercase' }}>✓ Session created</p>
            <p style={{ margin: '0 0 8px', fontFamily: 'monospace', fontSize: '11px', color: '#6B7280', wordBreak: 'break-all' }}>{session.sessionId}</p>
            <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>
              Checkout URL: <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{session.checkoutUrl}</span>
            </p>
          </div>
          <button
            onClick={handlePay}
            style={{ background: '#000', color: 'white', border: 'none', borderRadius: '999px', padding: '15px 48px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', boxShadow: '6px 6px 0 0 #FF5C16', transition: 'all 0.15s' }}
          >
            Go to Coal checkout →
          </button>
          <button onClick={() => setSession(null)} style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            ← Start over
          </button>
        </div>
      )}

      {/* Code snippet */}
      <div className="code-block" style={{ marginTop: '48px', background: '#180D43', borderRadius: '24px', padding: '24px', fontSize: '12px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.65)', lineHeight: 1.8 }}>
        <p style={{ margin: '0 0 4px', color: '#FF5C16', fontWeight: 900, fontSize: '11px' }}>// Server: create-session/route.ts</p>
        <p style={{ margin: 0 }}>{'const res = await fetch(`${COAL_API_URL}/api/checkouts`, {'}</p>
        <p style={{ margin: 0 }}>&nbsp;&nbsp;{'method: "POST",'}</p>
        <p style={{ margin: 0 }}>&nbsp;&nbsp;{'headers: { "x-api-key": COAL_API_KEY },'}</p>
        <p style={{ margin: 0 }}>&nbsp;&nbsp;{'body: JSON.stringify({'}</p>
        <p style={{ margin: 0 }}>&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: '#a78bfa' }}>amount</span>{`: ${selected.price}, `}<span style={{ color: '#a78bfa' }}>productName</span>{`: "${selected.name} Plan",`}</p>
        <p style={{ margin: 0 }}>&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: '#a78bfa' }}>redirectUrl</span>{': "https://yourapp.com/success",'}</p>
        <p style={{ margin: 0 }}>&nbsp;&nbsp;{'}),'}</p>
        <p style={{ margin: '0 0 8px' }}>{'})'}</p>
        <p style={{ margin: '0 0 4px', color: '#FF5C16', fontWeight: 900, fontSize: '11px' }}>// Client: redirect with SDK</p>
        <p style={{ margin: 0 }}>{'import { CoalCheckoutButton } from "coal-react";'}</p>
        <p style={{ margin: 0 }}>{'<CoalCheckoutButton checkoutUrl={checkoutUrl} />'}</p>
      </div>
    </div>
  );
}
