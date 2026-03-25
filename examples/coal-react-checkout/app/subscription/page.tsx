'use client';

import { useState } from 'react';

const PLANS = [
  { id: 'monthly', name: 'Monthly', price: 19.99, interval: 'month', intervalCount: 1, desc: 'Billed every month, cancel anytime' },
  { id: 'quarterly', name: 'Quarterly', price: 49.99, interval: 'month', intervalCount: 3, desc: 'Billed every 3 months, save 17%' },
  { id: 'annual', name: 'Annual', price: 149.99, interval: 'year', intervalCount: 1, desc: 'Billed once per year, save 37%', badge: 'Best value' },
];

export default function SubscriptionPage() {
  const [selected, setSelected] = useState(PLANS[2]);
  const [consent, setConsent] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState<{ sessionId: string; checkoutUrl: string } | null>(null);

  const handleCreate = async () => {
    if (!consent) { setError('You must accept the recurring billing terms'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: selected.price,
          productName: `Coal Pro — ${selected.name}`,
          productDescription: selected.desc,
          callbackUrl: undefined,
          payerInfo: email ? { required: false, fields: ['email'] } : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.sessionId) throw new Error(data.error || 'Failed to create subscription session');
      setSession({ sessionId: data.sessionId, checkoutUrl: data.checkoutUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error creating session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ marginBottom: '40px' }}>
        <span style={{ display: 'inline-block', background: 'white', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: '999px', padding: '4px 14px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#FF5C16', marginBottom: '16px' }}>
          Subscription demo
        </span>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 900, color: '#180D43', margin: '0 0 10px', letterSpacing: '-0.04em' }}>Recurring Payments</h1>
        <p style={{ color: '#6B7280', fontSize: '15px', margin: 0, lineHeight: 1.6 }}>
          Subscription checkouts require explicit billing consent. Coal captures wallet address for automatic renewal processing.
        </p>
      </div>

      {/* Plan selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '12px', marginBottom: '28px' }}>
        {PLANS.map(plan => {
          const isSelected = selected.id === plan.id;
          return (
            <button
              key={plan.id}
              onClick={() => { setSelected(plan); setSession(null); setError(''); }}
              style={{ background: 'white', border: `2px solid ${isSelected ? '#FF5C16' : 'rgba(0,0,0,0.08)'}`, borderRadius: '20px', padding: '20px', textAlign: 'left', cursor: 'pointer', boxShadow: isSelected ? '4px 4px 0 0 #FF5C16' : 'none', transition: 'all 0.2s', position: 'relative' }}
            >
              {plan.badge && (
                <span style={{ position: 'absolute', top: '12px', right: '12px', background: '#dcfce7', color: '#166534', fontSize: '9px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '999px' }}>{plan.badge}</span>
              )}
              <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9CA3AF' }}>{plan.name}</p>
              <p style={{ margin: '0 0 4px', fontSize: '1.75rem', fontWeight: 900, color: '#180D43', letterSpacing: '-0.03em' }}>${plan.price.toFixed(2)}</p>
              <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', fontWeight: 600 }}>{plan.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Consent + form */}
      <div style={{ background: 'white', borderRadius: '24px', border: '2px solid rgba(0,0,0,0.06)', padding: '24px', marginBottom: '20px' }}>
        <h3 style={{ margin: '0 0 18px', fontSize: '14px', fontWeight: 900, color: '#180D43' }}>Billing details</h3>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7280', marginBottom: '6px' }}>Email (optional)</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{ width: '100%', height: '44px', padding: '0 14px', borderRadius: '12px', border: '2px solid rgba(0,0,0,0.08)', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
          />
        </div>

        {/* Billing consent — required for subscriptions */}
        <div
          onClick={() => setConsent(v => !v)}
          style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px', background: consent ? '#fef3c7' : '#f9fafb', border: `2px solid ${consent ? '#fbbf24' : 'rgba(0,0,0,0.08)'}`, borderRadius: '16px', cursor: 'pointer', transition: 'all 0.2s', marginBottom: '20px' }}
        >
          <div style={{ width: '20px', height: '20px', borderRadius: '6px', border: `2px solid ${consent ? '#f59e0b' : 'rgba(0,0,0,0.15)'}`, background: consent ? '#f59e0b' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
            {consent && <span style={{ color: 'white', fontSize: '11px', fontWeight: 900 }}>✓</span>}
          </div>
          <div>
            <p style={{ margin: '0 0 3px', fontSize: '13px', fontWeight: 700, color: '#180D43' }}>
              I authorize recurring billing of <strong>${selected.price.toFixed(2)}</strong> every {selected.intervalCount > 1 ? `${selected.intervalCount} ` : ''}{selected.interval}
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: '#6B7280', lineHeight: 1.5 }}>
              Your wallet address will be stored for automatic renewal. Cancel any time from your account.
            </p>
          </div>
        </div>

        {/* Billing cycle explainer */}
        <div style={{ background: '#f5f2ed', borderRadius: '14px', padding: '14px 16px', marginBottom: '20px' }}>
          <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 900, color: '#180D43', textTransform: 'uppercase', letterSpacing: '0.1em' }}>How subscription billing works</p>
          {[
            { icon: '1', text: `Pay ${selected.price.toFixed(2)} USDC today — first billing cycle starts immediately` },
            { icon: '2', text: `Coal stores your wallet address and triggers renewal every ${selected.intervalCount > 1 ? selected.intervalCount + ' ' : ''}${selected.interval}` },
            { icon: '3', text: 'You\'ll receive webhooks for each renewal attempt — confirmed or failed' },
          ].map(s => (
            <div key={s.icon} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'flex-start' }}>
              <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#180D43', color: 'white', fontSize: '9px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>{s.icon}</span>
              <p style={{ margin: 0, fontSize: '12px', color: '#6B7280', fontWeight: 600 }}>{s.text}</p>
            </div>
          ))}
        </div>

        {error && <p style={{ color: '#dc2626', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

        {!session ? (
          <button
            onClick={handleCreate}
            disabled={loading}
            style={{ width: '100%', background: '#000', color: 'white', border: 'none', borderRadius: '14px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '4px 4px 0 0 #FF5C16', transition: 'all 0.15s', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Creating subscription…' : `Subscribe — $${selected.price.toFixed(2)}/${selected.interval} →`}
          </button>
        ) : (
          <div>
            <div style={{ background: '#f0fdf4', border: '2px solid #86efac', borderRadius: '12px', padding: '14px', marginBottom: '12px' }}>
              <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 900, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.1em' }}>✓ Subscription session ready</p>
              <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '11px', color: '#6B7280', wordBreak: 'break-all' }}>{session.sessionId}</p>
            </div>
            <button
              onClick={() => { if (session.checkoutUrl) window.location.href = session.checkoutUrl; }}
              style={{ width: '100%', background: '#000', color: 'white', border: 'none', borderRadius: '14px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', boxShadow: '4px 4px 0 0 #FF5C16' }}
            >
              Continue to checkout →
            </button>
          </div>
        )}
      </div>

      {/* Code snippet */}
      <div style={{ background: '#180D43', borderRadius: '20px', padding: '20px', fontFamily: 'monospace', fontSize: '11px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.8 }}>
        <p style={{ margin: '0 0 4px', color: '#FF5C16', fontWeight: 900 }}>// Subscription checkout — note subscriptionConsentAccepted</p>
        <p style={{ margin: 0 }}>{'POST /api/checkouts'}</p>
        <p style={{ margin: 0 }}>{'{'}</p>
        <p style={{ margin: 0 }}>&nbsp;&nbsp;<span style={{ color: '#a78bfa' }}>amount</span>{`: ${selected.price},`}</p>
        <p style={{ margin: 0 }}>&nbsp;&nbsp;<span style={{ color: '#a78bfa' }}>productName</span>{`: "Coal Pro — ${selected.name}",`}</p>
        <p style={{ margin: 0 }}>&nbsp;&nbsp;<span style={{ color: '#a78bfa' }}>metadata</span>{': { billingType: "subscription",'}</p>
        <p style={{ margin: 0 }}>&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: '#a78bfa' }}>billingInterval</span>{`: "${selected.interval}", billingIntervalCount: ${selected.intervalCount} },`}</p>
        <p style={{ margin: 0 }}>&nbsp;&nbsp;<span style={{ color: '#a78bfa' }}>redirectUrl</span>{': "https://yourapp.com/success"'}</p>
        <p style={{ margin: 0 }}>{'}'}</p>
        <p style={{ margin: '8px 0 0', color: '#6b7280' }}>{'// User must confirm subscriptionConsentAccepted: true at checkout'}</p>
      </div>
    </div>
  );
}
