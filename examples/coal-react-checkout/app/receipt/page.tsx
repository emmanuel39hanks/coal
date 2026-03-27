'use client';

import { useState } from 'react';

const COAL_API_URL = process.env.NEXT_PUBLIC_COAL_API_URL || 'http://localhost:3001';

interface ProofTrail {
  storage: {
    storageUri: string;
    storageRoot: string;
    storageTxHash: string;
    payloadHash: string;
    explorerUrl: string | null;
    publishedAt: string;
  } | null;
  chain: {
    anchorTxHash: string;
    anchorContract: string;
    anchorChainId: number;
    payloadHash: string;
    explorerUrl: string;
    anchoredAt: string;
  } | null;
}

interface ReceiptData {
  checkoutId: string;
  status: string;
  verified: boolean;
  merchant?: { name: string | null };
  payment?: {
    amount: string;
    currency: string;
    description: string | null;
    txHash: string;
    explorerUrl: string;
    paidAt: string;
  };
  proofTrail: ProofTrail | null;
}

type StepStatus = 'verified' | 'pending' | 'missing';

function getStepColors(status: StepStatus) {
  if (status === 'verified') return { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' };
  if (status === 'pending') return { bg: '#fef9c3', text: '#854d0e', border: '#fde68a' };
  return { bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb' };
}

function getStepLabel(status: StepStatus) {
  if (status === 'verified') return 'Verified';
  if (status === 'pending') return 'Pending';
  return 'Missing';
}

export default function ReceiptPage() {
  const [checkoutId, setCheckoutId] = useState('');
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const verify = async () => {
    const id = checkoutId.trim();
    if (!id) return;

    setLoading(true);
    setError(null);
    setNotFound(false);
    setReceipt(null);

    try {
      const res = await fetch(`${COAL_API_URL}/api/receipts/${encodeURIComponent(id)}`);
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError(`API returned ${res.status}`);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setReceipt(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch receipt');
    } finally {
      setLoading(false);
    }
  };

  const trail = receipt?.proofTrail;

  const paymentStatus: StepStatus = receipt?.payment ? 'verified' : 'missing';
  const storageStatus: StepStatus = trail?.storage ? 'verified' : receipt?.verified ? 'pending' : 'missing';
  const chainStatus: StepStatus = trail?.chain ? 'verified' : receipt?.verified ? 'pending' : 'missing';

  const proofSteps = [
    {
      num: 1,
      title: 'Payment on Base',
      description: 'USDC transfer confirmed on-chain',
      status: paymentStatus,
      hash: receipt?.payment?.txHash,
      explorerUrl: receipt?.payment?.explorerUrl,
      explorerLabel: 'View on BaseScan',
      timestamp: receipt?.payment?.paidAt,
    },
    {
      num: 2,
      title: 'Receipt on 0G Storage',
      description: 'Immutable receipt payload published to 0G decentralized storage',
      status: storageStatus,
      hash: trail?.storage?.payloadHash,
      explorerUrl: trail?.storage?.explorerUrl,
      explorerLabel: 'View on StorageScan',
      timestamp: trail?.storage?.publishedAt,
    },
    {
      num: 3,
      title: 'Anchor on 0G Chain',
      description: 'Receipt hash anchored on 0G Chain for tamper-proof verification',
      status: chainStatus,
      hash: trail?.chain?.anchorTxHash,
      explorerUrl: trail?.chain?.explorerUrl,
      explorerLabel: 'View on ChainScan',
      timestamp: trail?.chain?.anchoredAt,
    },
  ];

  return (
    <div className="page-container" style={{ maxWidth: '720px', margin: '0 auto', padding: '48px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '36px' }}>
        <span style={{ display: 'inline-block', background: 'white', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: '999px', padding: '4px 14px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#FF5C16', marginBottom: '16px' }}>
          Receipt Verification
        </span>
        <h1 className="page-title" style={{ fontSize: '2.25rem', fontWeight: 900, color: '#180D43', margin: '0 0 10px', letterSpacing: '-0.04em' }}>
          Verify any payment
        </h1>
        <p style={{ color: '#6B7280', fontSize: '15px', margin: 0, lineHeight: 1.6 }}>
          Enter a checkout ID to view the 3-step proof trail: Payment on Base, Receipt on 0G Storage, Anchor on 0G Chain. Public and permissionless.
        </p>
      </div>

      {/* Search */}
      <div style={{ background: 'white', borderRadius: '20px', border: '2px solid rgba(0,0,0,0.06)', padding: '24px', marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '10px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7280', marginBottom: '8px' }}>
          Checkout ID
        </label>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            value={checkoutId}
            onChange={e => setCheckoutId(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') verify(); }}
            placeholder="cm9x4k... (paste a checkout ID)"
            style={{ flex: 1, height: '44px', padding: '0 14px', borderRadius: '12px', border: '2px solid rgba(0,0,0,0.08)', fontSize: '13px', fontFamily: 'monospace', boxSizing: 'border-box', outline: 'none' }}
          />
          <button
            onClick={verify}
            disabled={loading || !checkoutId.trim()}
            style={{
              height: '44px',
              padding: '0 24px',
              background: loading ? '#6B7280' : '#000',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '3px 3px 0 0 #FF5C16',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div style={{ background: '#fef2f2', borderRadius: '16px', border: '2px solid #fecaca', padding: '20px', marginBottom: '24px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#991b1b' }}>{error}</p>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#b91c1c' }}>Check the checkout ID and try again.</p>
        </div>
      )}

      {/* Not found state */}
      {notFound && (
        <div style={{ background: '#f9fafb', borderRadius: '16px', border: '2px solid rgba(0,0,0,0.06)', padding: '32px', marginBottom: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔍</div>
          <p style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 900, color: '#180D43' }}>Receipt not found</p>
          <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>This checkout ID does not exist or the payment has not been confirmed yet.</p>
        </div>
      )}

      {/* Receipt result */}
      {receipt && (
        <>
          {/* Payment summary */}
          {receipt.payment && (
            <div style={{ background: 'white', borderRadius: '20px', border: '2px solid rgba(0,0,0,0.06)', padding: '24px', marginBottom: '16px', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '24px' }}>
                {receipt.verified ? '✓' : '⏳'}
              </div>
              <p style={{ margin: '0 0 4px', fontSize: '24px', fontWeight: 900, color: '#180D43' }}>
                {receipt.payment.amount} {receipt.payment.currency}
              </p>
              {receipt.merchant?.name && (
                <p style={{ margin: '0 0 4px', fontSize: '14px', color: '#6B7280', fontWeight: 600 }}>
                  to {receipt.merchant.name}
                </p>
              )}
              {receipt.payment.description && (
                <p style={{ margin: 0, fontSize: '13px', color: '#9CA3AF' }}>{receipt.payment.description}</p>
              )}
              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: '6px', background: receipt.verified ? '#dcfce7' : '#fef9c3', color: receipt.verified ? '#166534' : '#854d0e' }}>
                  {receipt.status}
                </span>
              </div>
            </div>
          )}

          {/* Proof Trail */}
          <div style={{ background: 'white', borderRadius: '20px', border: '2px solid rgba(0,0,0,0.06)', padding: '24px', marginBottom: '16px' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#180D43' }}>
              Proof Trail
            </h2>

            {proofSteps.map((ps, idx) => {
              const colors = getStepColors(ps.status);
              const isLast = idx === proofSteps.length - 1;
              return (
                <div key={ps.num} style={{ display: 'flex', gap: '16px' }}>
                  {/* Step indicator + connector */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                      background: colors.bg, color: colors.text,
                      fontSize: '13px', fontWeight: 900,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {ps.status === 'verified' ? '✓' : ps.num}
                    </div>
                    {!isLast && (
                      <div style={{ width: '2px', flex: 1, margin: '4px 0', background: colors.border }} />
                    )}
                  </div>

                  {/* Step content */}
                  <div style={{ paddingBottom: isLast ? 0 : '24px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 900, color: '#180D43' }}>{ps.title}</span>
                      <span style={{
                        display: 'inline-block', fontSize: '10px', fontWeight: 900,
                        padding: '2px 8px', borderRadius: '6px',
                        background: colors.bg, color: colors.text,
                      }}>
                        {getStepLabel(ps.status)}
                      </span>
                    </div>
                    <p style={{ margin: '0 0 6px', fontSize: '12px', color: '#6B7280', fontWeight: 500 }}>{ps.description}</p>
                    {ps.hash && (
                      <p style={{ margin: '0 0 4px', fontSize: '11px', fontFamily: 'monospace', color: '#9CA3AF', wordBreak: 'break-all' }}>
                        {ps.hash}
                      </p>
                    )}
                    {ps.timestamp && (
                      <p style={{ margin: '0 0 4px', fontSize: '11px', color: '#9CA3AF' }}>
                        {new Date(ps.timestamp).toLocaleString()}
                      </p>
                    )}
                    {ps.explorerUrl && (
                      <a
                        href={ps.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, color: '#FF5C16', textDecoration: 'none' }}
                      >
                        {ps.explorerLabel}
                        <span style={{ fontSize: '10px' }}>↗</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Verification Details */}
          <div style={{ background: 'white', borderRadius: '20px', border: '2px solid rgba(0,0,0,0.06)', padding: '24px', marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 14px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#180D43' }}>
              Verification Details
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280' }}>Checkout ID</span>
                <span className="mono-break" style={{ fontSize: '12px', fontFamily: 'monospace', color: '#374151' }}>{receipt.checkoutId}</span>
              </div>
              {receipt.payment?.txHash && (
                <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280' }}>Tx Hash</span>
                  <span className="mono-break" style={{ fontSize: '11px', fontFamily: 'monospace', color: '#374151', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {receipt.payment.txHash}
                  </span>
                </div>
              )}
              {trail?.storage?.storageRoot && (
                <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280' }}>Storage Root</span>
                  <span className="mono-break" style={{ fontSize: '11px', fontFamily: 'monospace', color: '#374151', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {trail.storage.storageRoot}
                  </span>
                </div>
              )}
              {trail?.chain?.anchorContract && (
                <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280' }}>Anchor Contract</span>
                  <span className="mono-break" style={{ fontSize: '11px', fontFamily: 'monospace', color: '#374151', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {trail.chain.anchorContract}
                  </span>
                </div>
              )}
              {trail?.chain?.anchorChainId && (
                <div className="detail-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280' }}>0G Chain ID</span>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#374151' }}>{trail.chain.anchorChainId}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', fontWeight: 600 }}>
              Powered by <span style={{ fontWeight: 900, color: '#180D43' }}>Coal</span> x <span style={{ fontWeight: 900, color: '#180D43' }}>0G</span>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
