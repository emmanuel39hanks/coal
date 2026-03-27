'use client';

import { useState, useCallback } from 'react';
import { CoalCheckoutButton } from 'coal-react';

type Step = 'form' | 'ready' | 'error';

export default function EmbedDemoPage() {
  const [step, setStep] = useState<Step>('form');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [amount, setAmount] = useState('25.00');
  const [productName, setProductName] = useState('Premium Access');
  const [description, setDescription] = useState('');

  const handleCreate = useCallback(async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) { setErrorMsg('Enter a valid amount'); setStep('error'); return; }
    setIsCreating(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parsed, productName: productName || 'Checkout', productDescription: description || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.sessionId) throw new Error(data.error || 'Failed to create session');
      setSessionId(data.sessionId);
      setCheckoutUrl(data.checkoutUrl || null);
      setStep('ready');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setStep('error');
    } finally {
      setIsCreating(false);
    }
  }, [amount, productName, description]);

  const reset = () => { setStep('form'); setSessionId(null); setCheckoutUrl(null); setErrorMsg(''); };

  const label = (text: string) => (
    <label style={{ display: 'block', fontSize: '11px', fontWeight: 900, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#6B7280', marginBottom: '6px' }}>{text}</label>
  );

  const inputEl = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} style={{ width: '100%', height: '48px', padding: '0 16px', borderRadius: '12px', border: '2px solid rgba(0,0,0,0.08)', fontSize: '15px', fontWeight: 600, color: '#180D43', background: 'white', outline: 'none', boxSizing: 'border-box', ...props.style }} />
  );

  return (
    <div className="page-container embed-layout" style={{ minHeight: '100vh', background: '#f5f2ed', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 24px', gap: '32px', flexWrap: 'wrap' }}>

      {/* Left panel */}
      <div className="side-panel-fixed" style={{ width: '340px', flexShrink: 0 }}>
        <div style={{ marginBottom: '32px' }}>
          <span style={{ display: 'inline-block', background: 'white', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '999px', padding: '4px 14px', fontSize: '11px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#FF5C16', marginBottom: '12px' }}>
            Redirect checkout demo
          </span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#180D43', margin: '0 0 8px', letterSpacing: '-0.04em' }}>
            &lt;CoalCheckoutButton /&gt;
          </h1>
          <p style={{ color: '#6B7280', fontSize: '14px', margin: 0 }}>
            Create a session, then redirect the user to a fully-hosted Coal checkout page.
          </p>
        </div>

        {/* Config form */}
        <div style={{ background: 'white', borderRadius: '24px', padding: '24px', border: '2px solid rgba(0,0,0,0.06)', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 900, color: '#180D43', margin: '0 0 20px', letterSpacing: '-0.02em' }}>Session config</h2>
          <div style={{ marginBottom: '16px' }}>
            {label('Amount (USDC)')}
            {inputEl({ type: 'number', value: amount, min: '0.01', step: '0.01', onChange: e => setAmount(e.target.value), placeholder: '25.00' })}
          </div>
          <div style={{ marginBottom: '16px' }}>
            {label('Product name')}
            {inputEl({ type: 'text', value: productName, onChange: e => setProductName(e.target.value), placeholder: 'Premium Access' })}
          </div>
          <div style={{ marginBottom: '24px' }}>
            {label('Description (optional)')}
            {inputEl({ type: 'text', value: description, onChange: e => setDescription(e.target.value), placeholder: 'Unlock full course content' })}
          </div>
          <button
            onClick={handleCreate}
            disabled={isCreating || step === 'ready'}
            style={{ width: '100%', height: '48px', background: step === 'ready' ? '#d1fae5' : '#000', color: step === 'ready' ? '#065f46' : 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: 700, cursor: isCreating || step === 'ready' ? 'default' : 'pointer', boxShadow: step === 'ready' ? 'none' : '4px 4px 0px 0px #FF5C16', transition: 'all 0.15s' }}
          >
            {isCreating ? 'Creating session…' : step === 'ready' ? '✓ Session ready' : 'Create session →'}
          </button>
        </div>

        {/* Session info */}
        {sessionId && (
          <div style={{ background: 'white', borderRadius: '16px', padding: '16px 20px', border: '2px solid rgba(0,0,0,0.06)', fontSize: '12px' }}>
            <p style={{ margin: '0 0 4px', fontWeight: 900, color: '#180D43', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Session ID</p>
            <p style={{ margin: 0, fontFamily: 'monospace', color: '#6B7280', wordBreak: 'break-all' }}>{sessionId}</p>
          </div>
        )}

        {/* Code snippet */}
        <div style={{ marginTop: '20px', background: '#180D43', borderRadius: '16px', padding: '20px', fontSize: '12px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.7)', lineHeight: '1.7' }}>
          <p style={{ margin: '0 0 2px', color: '#FF5C16', fontWeight: 900 }}>{'// Your code'}</p>
          <p style={{ margin: 0 }}>{'import { CoalCheckoutButton }'}</p>
          <p style={{ margin: 0 }}>{'  from "coal-react";'}</p>
          <p style={{ margin: 0 }}>&nbsp;</p>
          <p style={{ margin: 0 }}>{'<CoalCheckoutButton'}</p>
          <p style={{ margin: 0 }}>&nbsp;&nbsp;{`checkoutUrl="${checkoutUrl || 'https://...'}" `}</p>
          <p style={{ margin: 0 }}>{'/>'}  </p>
        </div>
      </div>

      {/* Right panel — preview */}
      <div className="side-panel-fixed" style={{ flex: 1, minWidth: '340px', maxWidth: '500px' }}>
        {step === 'form' && (
          <div style={{ background: 'white', borderRadius: '32px', border: '2px dashed rgba(0,0,0,0.1)', height: '480px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⬡</div>
            <p style={{ fontWeight: 700, margin: '0 0 6px' }}>Button will appear here</p>
            <p style={{ fontSize: '13px', margin: 0 }}>Create a session to see the checkout button →</p>
          </div>
        )}

        {step === 'ready' && sessionId && (
          <div style={{ background: 'white', borderRadius: '32px', border: '2px solid rgba(0,0,0,0.06)', boxShadow: '0 20px 60px rgba(24,13,67,0.10)', overflow: 'hidden' }}>
            {/* Product header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 900, color: '#180D43' }}>{productName}</p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6B7280', fontWeight: 600 }}>${amount} USDC</p>
              </div>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            </div>

            {/* Button demo area */}
            <div style={{ padding: '48px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#9CA3AF', fontWeight: 600 }}>Click to go to checkout</p>

              <CoalCheckoutButton
                checkoutUrl={checkoutUrl ?? undefined}
                sessionId={!checkoutUrl ? sessionId : undefined}
                target="_blank"
                style={{ width: '100%', maxWidth: '280px', height: '52px', fontSize: '15px' }}
              />

              <button
                onClick={reset}
                style={{ background: 'none', border: 'none', fontSize: '12px', color: '#9CA3AF', cursor: 'pointer', fontWeight: 600, padding: '4px 8px' }}
              >
                Reset →
              </button>
            </div>

            {/* What happens next */}
            <div style={{ margin: '0 24px 24px', background: '#f5f2ed', borderRadius: '16px', padding: '16px 20px' }}>
              <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 900, color: '#180D43', letterSpacing: '0.1em', textTransform: 'uppercase' }}>What happens next</p>
              {[
                'User is redirected to the Coal checkout page',
                'They connect wallet & confirm the payment',
                'Coal redirects them back to your redirectUrl',
                'You verify the payment server-side with your API key',
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: i < 3 ? '8px' : 0 }}>
                  <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#180D43', color: 'white', fontSize: '10px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>{i + 1}</span>
                  <p style={{ margin: 0, fontSize: '12px', color: '#6B7280', fontWeight: 600, lineHeight: '1.5' }}>{step}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'error' && (
          <div style={{ background: 'white', borderRadius: '32px', border: '2px solid #fecaca', padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>✕</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#180D43', margin: '0 0 8px' }}>Error</h2>
            <p style={{ color: '#EF4444', marginBottom: '24px', fontSize: '13px', fontFamily: 'monospace' }}>{errorMsg}</p>
            <button onClick={reset} style={{ background: '#000', color: 'white', border: 'none', borderRadius: '999px', padding: '12px 28px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', boxShadow: '4px 4px 0px 0px #FF5C16' }}>
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
