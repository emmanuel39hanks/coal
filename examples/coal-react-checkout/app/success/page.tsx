'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SuccessContent() {
  const params = useSearchParams();
  const sessionId = params.get('sessionId') || params.get('session_id');
  const txHash = params.get('txHash') || params.get('tx_hash');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ textAlign: 'center', maxWidth: '480px' }}>
        <div style={{ width: '80px', height: '80px', background: '#ECFDF5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '36px' }}>
          ✓
        </div>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 900, color: '#180D43', margin: '0 0 12px', letterSpacing: '-0.04em' }}>
          Payment confirmed!
        </h1>
        <p style={{ color: '#6B7280', fontSize: '15px', marginBottom: '32px', lineHeight: 1.6 }}>
          Your payment was processed successfully on Base.
        </p>

        {txHash && (
          <a
            href={`https://basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'white', border: '2px solid rgba(0,0,0,0.08)', borderRadius: '999px', padding: '10px 20px', fontSize: '13px', fontWeight: 700, color: '#180D43', textDecoration: 'none', marginBottom: '16px' }}
          >
            View transaction on Basescan →
          </a>
        )}

        {sessionId && (
          <p style={{ fontSize: '11px', color: '#9CA3AF', fontFamily: 'monospace', marginBottom: '32px', wordBreak: 'break-all' }}>
            Session: {sessionId}
          </p>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href="/"
            style={{ background: '#000', color: 'white', textDecoration: 'none', borderRadius: '999px', padding: '12px 28px', fontSize: '14px', fontWeight: 700, boxShadow: '4px 4px 0px 0px #FF5C16' }}
          >
            Back to plans
          </a>
          <a
            href="/embed"
            style={{ background: 'white', color: '#180D43', textDecoration: 'none', borderRadius: '999px', padding: '12px 28px', fontSize: '14px', fontWeight: 700, border: '2px solid rgba(0,0,0,0.08)' }}
          >
            Try embed demo
          </a>
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
