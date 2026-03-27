'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function SuccessContent() {
  const params = useSearchParams();
  const sessionId = params.get('sessionId') || params.get('session_id');
  const txHash = params.get('txHash') || params.get('tx_hash');
  const [status, setStatus] = useState<'loading' | 'confirmed' | 'pending' | 'error'>('loading');
  const [sessionData, setSessionData] = useState<any>(null);

  useEffect(() => {
    if (!sessionId) { setStatus('confirmed'); return; }
    fetch(`/api/check-status?sessionId=${encodeURIComponent(sessionId)}`)
      .then(r => r.json())
      .then(d => {
        setSessionData(d?.data ?? d);
        const s = d?.data?.status ?? d?.status;
        setStatus(s === 'completed' || s === 'paid' ? 'confirmed' : s === 'pending' ? 'pending' : 'confirmed');
      })
      .catch(() => setStatus('confirmed'));
  }, [sessionId]);

  const DEMOS = [
    { href: '/receipt', label: 'Verify receipt' },
    { href: '/paywall', label: 'Test x402 Paywall' },
    { href: '/agent', label: 'AI Agent demo' },
    { href: '/subscription', label: 'Try subscriptions' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#f5f2ed' }}>
      <div style={{ maxWidth: '520px', width: '100%' }}>
        {/* Success card */}
        <div style={{ background: 'white', borderRadius: '28px', padding: '40px', textAlign: 'center', boxShadow: '0 4px 40px rgba(24,13,67,0.08)', marginBottom: '20px' }}>
          <div style={{ width: '72px', height: '72px', background: '#ECFDF5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '32px' }}>
            ✓
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, color: '#180D43', margin: '0 0 10px', letterSpacing: '-0.04em' }}>
            Payment confirmed!
          </h1>
          <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '28px', lineHeight: 1.6 }}>
            Your on-chain payment was verified on Base. Funds delivered to the merchant.
          </p>

          {/* Details */}
          <div style={{ background: '#f9fafb', borderRadius: '16px', padding: '16px', marginBottom: '24px', textAlign: 'left' }}>
            {sessionData?.productName && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#9CA3AF' }}>Product</span>
                <span style={{ fontSize: '12px', fontWeight: 900, color: '#180D43' }}>{sessionData.productName}</span>
              </div>
            )}
            {(sessionData?.amount || sessionData?.amountUsd) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#9CA3AF' }}>Amount</span>
                <span style={{ fontSize: '12px', fontWeight: 900, color: '#180D43' }}>${sessionData.amount ?? sessionData.amountUsd} USDC</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: sessionId ? '10px' : '0' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#9CA3AF' }}>Network</span>
              <span style={{ fontSize: '12px', fontWeight: 900, color: '#180D43' }}>Base (ERC-20)</span>
            </div>
            {sessionId && (
              <div style={{ paddingTop: '10px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 700, color: '#9CA3AF' }}>Session ID</p>
                <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '10px', color: '#6B7280', wordBreak: 'break-all' }}>{sessionId}</p>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sessionId && (
              <a
                href={`/receipt?id=${sessionId}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#ecfdf5', border: '2px solid #bbf7d0', borderRadius: '12px', padding: '12px', fontSize: '13px', fontWeight: 700, color: '#166534', textDecoration: 'none' }}
              >
                🧾 Verify Receipt (0G Proof Trail)
              </a>
            )}
            {txHash && (
              <a
                href={`https://basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#f9fafb', border: '2px solid rgba(0,0,0,0.06)', borderRadius: '12px', padding: '12px', fontSize: '13px', fontWeight: 700, color: '#180D43', textDecoration: 'none' }}
              >
                View on Basescan ↗
              </a>
            )}
            <a
              href="/"
              style={{ display: 'block', background: '#000', color: 'white', textDecoration: 'none', borderRadius: '12px', padding: '13px', fontSize: '14px', fontWeight: 700, boxShadow: '4px 4px 0 0 #FF5C16', textAlign: 'center' }}
            >
              Back to demos →
            </a>
          </div>
        </div>

        {/* Try more demos */}
        <div className="success-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {DEMOS.map(d => (
            <a
              key={d.href}
              href={d.href}
              style={{ background: 'white', border: '2px solid rgba(0,0,0,0.06)', borderRadius: '16px', padding: '14px 16px', textDecoration: 'none', fontSize: '13px', fontWeight: 700, color: '#180D43', display: 'block', textAlign: 'center', transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#FF5C16'; (e.currentTarget as HTMLElement).style.boxShadow = '3px 3px 0 0 #FF5C16'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,0,0,0.06)'; (e.currentTarget as HTMLElement).style.boxShadow = ''; }}
            >
              {d.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
