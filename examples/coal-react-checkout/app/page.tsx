'use client';

import { useState, useCallback } from 'react';

type Step = 'select' | 'error';

const PRODUCTS = [
  { id: 'starter', name: 'Starter Plan', description: 'Perfect for indie devs', price: 9.99, features: ['5 payment links', 'Webhook notifications', 'Community support'] },
  { id: 'pro', name: 'Pro Plan', description: 'For growing teams', price: 29.99, features: ['Unlimited links', 'Revenue splits', 'Priority support', 'Advanced analytics'] },
  { id: 'lifetime', name: 'Lifetime Access', description: 'One-time, yours forever', price: 199.00, features: ['Everything in Pro', 'All future features', 'Dedicated onboarding'] },
];

export default function CheckoutPage() {
  const [step, setStep] = useState<Step>('select');
  const [selected, setSelected] = useState(PRODUCTS[1]);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const coalBaseUrl = process.env.NEXT_PUBLIC_COAL_BASE_URL || 'https://usecoal.xyz';

  const handleStartCheckout = useCallback(async () => {
    setIsCreating(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: selected.price, productName: selected.name, productDescription: selected.description }),
      });
      const data = await res.json();
      if (!res.ok || !data.sessionId) throw new Error(data.error || 'Failed to create checkout session');
      // Redirect directly — SDK is redirect-based, no iframe
      const url = data.checkoutUrl || `${coalBaseUrl}/pay/checkout/${data.sessionId}`;
      window.location.href = url;
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
      setStep('error');
      setIsCreating(false);
    }
  }, [selected, coalBaseUrl]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '900px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <span style={{ display: 'inline-block', background: 'white', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '999px', padding: '4px 14px', fontSize: '11px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#FF5C16', marginBottom: '16px' }}>
            Powered by coal-react
          </span>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#180D43', margin: '0 0 8px', letterSpacing: '-0.04em' }}>
            Choose your plan
          </h1>
          <p style={{ color: '#6B7280', fontSize: '1rem', margin: 0 }}>
            Crypto payments on Base. No fees. Instant settlement.
          </p>
        </div>

        {/* Step: select product */}
        {step === 'select' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '32px' }}>
              {PRODUCTS.map((product) => {
                const isSelected = selected.id === product.id;
                const isHighlighted = product.id === 'pro';
                return (
                  <button
                    key={product.id}
                    onClick={() => setSelected(product)}
                    style={{
                      background: isHighlighted ? '#180D43' : 'white',
                      border: isSelected ? '2px solid #FF5C16' : '2px solid rgba(0,0,0,0.06)',
                      borderRadius: '24px',
                      padding: '28px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '4px 4px 0px 0px #FF5C16' : isHighlighted ? '4px 4px 0px 0px #FF5C16' : 'none',
                      transition: 'all 0.2s',
                      position: 'relative',
                    }}
                  >
                    {isHighlighted && (
                      <span style={{ position: 'absolute', top: '16px', right: '16px', background: '#FF5C16', color: 'white', borderRadius: '999px', padding: '2px 10px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        Popular
                      </span>
                    )}
                    <p style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.18em', textTransform: 'uppercase', color: isHighlighted ? 'rgba(255,255,255,0.5)' : '#6B7280', margin: '0 0 8px' }}>
                      {product.name}
                    </p>
                    <p style={{ fontSize: '2.25rem', fontWeight: 900, color: isHighlighted ? 'white' : '#180D43', margin: '0 0 4px', letterSpacing: '-0.04em' }}>
                      ${product.price.toFixed(2)}
                    </p>
                    <p style={{ fontSize: '13px', color: isHighlighted ? 'rgba(255,255,255,0.5)' : '#9CA3AF', margin: '0 0 20px' }}>
                      {product.description}
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {product.features.map((f) => (
                        <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: isHighlighted ? 'rgba(255,255,255,0.8)' : '#180D43' }}>
                          <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: isHighlighted ? 'rgba(255,92,22,0.2)' : '#F5F2ED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#FF5C16', fontWeight: 900, flexShrink: 0 }}>✓</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            <div style={{ textAlign: 'center' }}>
              <button
                onClick={handleStartCheckout}
                disabled={isCreating}
                style={{
                  background: '#000',
                  color: 'white',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '14px 40px',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: isCreating ? 'not-allowed' : 'pointer',
                  boxShadow: isCreating ? 'none' : '6px 6px 0px 0px #FF5C16',
                  transition: 'all 0.15s',
                  opacity: isCreating ? 0.7 : 1,
                }}
              >
                {isCreating ? 'Creating session…' : `Pay $${selected.price.toFixed(2)} with crypto →`}
              </button>
              <p style={{ marginTop: '12px', fontSize: '12px', color: '#9CA3AF' }}>
                Non-custodial · Funds go directly to merchant · ~2 sec settlement on Base
              </p>
            </div>
          </div>
        )}

        {/* Step: error */}
        {step === 'error' && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ width: '72px', height: '72px', background: '#FEF2F2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '32px' }}>
              ✕
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#180D43', margin: '0 0 8px' }}>Something went wrong</h2>
            <p style={{ color: '#EF4444', marginBottom: '32px', fontSize: '14px', fontFamily: 'monospace' }}>{errorMessage}</p>
            <button
              onClick={() => { setStep('select'); setErrorMessage(''); }}
              style={{ background: '#000', color: 'white', border: 'none', borderRadius: '999px', padding: '12px 32px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', boxShadow: '4px 4px 0px 0px #FF5C16' }}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
