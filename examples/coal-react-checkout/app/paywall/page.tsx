'use client';

import { useState } from 'react';

type VerifyResult =
  | { paid: true; content: any; contentUrl: string | null; entitlement: any }
  | {
      paid: false;
      price: string; currency: string; pricingModel: string;
      payUrl: string; paymentMethods: any[]; zeroG: any;
    };

export default function PaywallPage() {
  const [paywallId, setPaywallId] = useState(process.env.NEXT_PUBLIC_PAYWALL_ID || '');
  const [address, setAddress] = useState('');
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<number | null>(null);
  const [payLoading, setPayLoading] = useState(false);
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState('');

  const handleVerify = async () => {
    if (!paywallId.trim()) { setError('Enter a paywall ID'); return; }
    setVerifyLoading(true);
    setError('');
    setVerifyResult(null);
    try {
      const res = await fetch(`/api/check-paywall?id=${encodeURIComponent(paywallId)}&address=${encodeURIComponent(address)}`);
      const data = await res.json();
      setVerifyStatus(res.status);
      setVerifyResult(data);
    } catch (e) {
      setError('Failed to check paywall');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handlePay = async () => {
    if (!txHash.trim()) { setError('Enter a transaction hash'); return; }
    if (!address.trim()) { setError('Enter a wallet address'); return; }
    setPayLoading(true);
    setError('');
    try {
      const res = await fetch('/api/pay-paywall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paywallId, address, txHash }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed');
      // Re-verify to show updated state
      await handleVerify();
      setTxHash('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setPayLoading(false);
    }
  };

  const createSession = async () => {
    if (!paywallId) return;
    try {
      const res = await fetch('/api/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: verifyResult && !verifyResult.paid ? parseFloat(verifyResult.price) : 1,
          productName: 'Paywall Access',
          productDescription: `Access to paywall ${paywallId}`,
        }),
      });
      const data = await res.json();
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    } catch (e) {
      setError('Failed to create session');
    }
  };

  const statusColor = verifyStatus === 200 ? '#22c55e' : verifyStatus === 402 ? '#ef4444' : '#6B7280';
  const statusLabel = verifyStatus === 200 ? '200 OK — Access granted' : verifyStatus === 402 ? '402 Payment Required' : null;

  return (
    <div className="page-container" style={{ maxWidth: '800px', margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ marginBottom: '40px' }}>
        <span style={{ display: 'inline-block', background: 'white', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: '999px', padding: '4px 14px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#FF5C16', marginBottom: '16px' }}>
          x402 Paywall Demo
        </span>
        <h1 className="page-title" style={{ fontSize: '2.25rem', fontWeight: 900, color: '#180D43', margin: '0 0 10px', letterSpacing: '-0.04em' }}>HTTP 402 Payment Required</h1>
        <p style={{ color: '#6B7280', fontSize: '15px', margin: 0, lineHeight: 1.6 }}>
          Coal returns <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 6px', borderRadius: '6px', fontFamily: 'monospace' }}>402</code> until proof of payment is submitted. Perfect for gating APIs, content, or files — works natively with AI agents.
        </p>
      </div>

      {/* How it works */}
      <div className="steps-row" style={{ display: 'flex', gap: '0', marginBottom: '32px', background: 'white', borderRadius: '20px', border: '2px solid rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        {[
          { step: '1', icon: '🔍', title: 'Verify access', body: 'GET /api/paywalls/[id]/verify → returns 200 (paid) or 402 (not paid)' },
          { step: '2', icon: '💳', title: 'Pay on-chain', body: 'User sends USDC on Base, submits txHash to /api/paywalls/[id]/pay' },
          { step: '3', icon: '✅', title: 'Access granted', body: '200 response with content data. Manifest published to 0G for agents.' },
        ].map((s, i) => (
          <div key={s.step} style={{ flex: 1, padding: '16px', borderLeft: i > 0 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
            <div style={{ fontSize: '20px', marginBottom: '8px' }}>{s.icon}</div>
            <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 900, color: '#180D43' }}>{s.title}</p>
            <p style={{ margin: 0, fontSize: '11px', color: '#6B7280', lineHeight: 1.5 }}>{s.body}</p>
          </div>
        ))}
      </div>

      {/* Input form */}
      <div style={{ background: 'white', borderRadius: '24px', border: '2px solid rgba(0,0,0,0.06)', padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 18px', fontSize: '14px', fontWeight: 900, color: '#180D43', letterSpacing: '-0.02em' }}>Check paywall access</h3>
        <div className="grid-stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7280', marginBottom: '6px' }}>Paywall ID *</label>
            <input
              value={paywallId}
              onChange={e => setPaywallId(e.target.value)}
              placeholder="cm9x4k..."
              style={{ width: '100%', height: '44px', padding: '0 14px', borderRadius: '12px', border: '2px solid rgba(0,0,0,0.08)', fontSize: '13px', fontWeight: 600, fontFamily: 'monospace', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7280', marginBottom: '6px' }}>Wallet address (optional)</label>
            <input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="0xd8dA..."
              style={{ width: '100%', height: '44px', padding: '0 14px', borderRadius: '12px', border: '2px solid rgba(0,0,0,0.08)', fontSize: '13px', fontWeight: 600, fontFamily: 'monospace', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
        </div>
        <button
          onClick={handleVerify}
          disabled={verifyLoading || !paywallId.trim()}
          style={{ background: '#000', color: 'white', border: 'none', borderRadius: '12px', padding: '12px 28px', fontSize: '14px', fontWeight: 700, cursor: verifyLoading ? 'not-allowed' : 'pointer', boxShadow: verifyLoading ? 'none' : '4px 4px 0 0 #FF5C16', transition: 'all 0.15s', opacity: verifyLoading || !paywallId.trim() ? 0.6 : 1 }}
        >
          {verifyLoading ? 'Checking…' : 'Check access →'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1.5px solid #fecaca', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>
          {error}
        </div>
      )}

      {/* Verify response */}
      {verifyResult && (
        <div style={{ marginBottom: '24px' }}>
          {/* Status badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: statusColor }} />
            <span style={{ fontSize: '13px', fontWeight: 900, color: statusColor }}>{statusLabel}</span>
          </div>

          {verifyResult.paid ? (
            <div style={{ background: '#f0fdf4', border: '2px solid #86efac', borderRadius: '20px', padding: '24px' }}>
              <p style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 900, color: '#166534' }}>✓ Access Granted</p>
              {verifyResult.contentUrl && (
                <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#166534' }}>
                  Content URL: <a href={verifyResult.contentUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#059669', wordBreak: 'break-all' }}>{verifyResult.contentUrl}</a>
                </p>
              )}
              {verifyResult.entitlement && (
                <pre style={{ margin: 0, background: 'rgba(0,0,0,0.04)', borderRadius: '10px', padding: '12px', fontSize: '11px', fontFamily: 'monospace', overflowX: 'auto' }}>
                  {JSON.stringify(verifyResult.entitlement, null, 2)}
                </pre>
              )}
            </div>
          ) : (
            <div style={{ background: '#fff1f2', border: '2px solid #fecdd3', borderRadius: '20px', padding: '24px' }}>
              <p style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 900, color: '#be123c' }}>🔒 Payment Required</p>
              <div className="stats-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '20px' }}>
                {[
                  { label: 'Price', value: `${verifyResult.price} ${verifyResult.currency}` },
                  { label: 'Model', value: verifyResult.pricingModel },
                  { label: '0G Manifest', value: verifyResult.zeroG?.manifestPublished ? '✓ Published' : '—' },
                ].map(stat => (
                  <div key={stat.label} style={{ background: 'white', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: 900, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{stat.label}</p>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 900, color: '#180D43' }}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Raw 402 response */}
              <div style={{ marginBottom: '20px' }}>
                <p style={{ margin: '0 0 6px', fontSize: '11px', fontWeight: 900, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>402 Response body</p>
                <pre style={{ margin: 0, background: '#180D43', borderRadius: '12px', padding: '14px', fontSize: '10px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.7)', overflowX: 'auto', maxHeight: '200px' }}>
                  {JSON.stringify(verifyResult, null, 2)}
                </pre>
              </div>

              {/* Payment options */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={createSession}
                  style={{ background: '#000', color: 'white', border: 'none', borderRadius: '12px', padding: '12px 24px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', boxShadow: '4px 4px 0 0 #FF5C16' }}
                >
                  Pay via Coal checkout →
                </button>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, minWidth: '260px' }}>
                  <input
                    value={txHash}
                    onChange={e => setTxHash(e.target.value)}
                    placeholder="0x... submit existing txHash"
                    style={{ flex: 1, height: '42px', padding: '0 12px', borderRadius: '10px', border: '2px solid rgba(0,0,0,0.1)', fontSize: '12px', fontFamily: 'monospace', outline: 'none' }}
                  />
                  <button
                    onClick={handlePay}
                    disabled={payLoading || !txHash.trim() || !address.trim()}
                    style={{ height: '42px', background: '#180D43', color: 'white', border: 'none', borderRadius: '10px', padding: '0 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', opacity: payLoading || !txHash || !address ? 0.5 : 1 }}
                  >
                    {payLoading ? '…' : 'Submit'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* x402 spec info */}
      <div className="code-block" style={{ background: '#180D43', borderRadius: '24px', padding: '24px' }}>
        <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>x402 Protocol</p>
        <p style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 700, color: 'white' }}>Standard HTTP response headers</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: 'monospace', fontSize: '12px' }}>
          {[
            { key: 'HTTP/1.1', val: '402 Payment Required', color: '#ef4444' },
            { key: 'X-Payment-Required:', val: 'true', color: '#a78bfa' },
            { key: 'X-Price:', val: '10.00 USDC', color: '#a78bfa' },
            { key: 'Content-Type:', val: 'application/json', color: '#6b7280' },
          ].map(h => (
            <div key={h.key} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '8px 12px' }}>
              <span style={{ color: h.color }}>{h.key}</span>
              {' '}
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{h.val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
