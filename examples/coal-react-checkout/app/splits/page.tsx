'use client';

import { useState } from 'react';

type Recipient = { address: string; percent: number; label: string };

const PRESETS = [
  {
    id: 'creator',
    name: 'Creator + Platform',
    desc: '80/20 split between creator and platform fee',
    recipients: [
      { address: '0xCreator...aBcD', percent: 80, label: 'Creator' },
      { address: '0xPlatform...eF12', percent: 20, label: 'Platform' },
    ],
  },
  {
    id: 'collab',
    name: '3-Way Collab',
    desc: 'Equal split between three collaborators',
    recipients: [
      { address: '0xAlice...1111', percent: 34, label: 'Alice' },
      { address: '0xBob...2222', percent: 33, label: 'Bob' },
      { address: '0xCarol...3333', percent: 33, label: 'Carol' },
    ],
  },
  {
    id: 'affiliate',
    name: 'Affiliate Program',
    desc: '90% merchant, 10% affiliate referral',
    recipients: [
      { address: '0xMerchant...FFFF', percent: 90, label: 'Merchant' },
      { address: '0xAffiliate...0000', percent: 10, label: 'Affiliate' },
    ],
  },
];

export default function SplitsPage() {
  const [selected, setSelected] = useState(PRESETS[0]);
  const [splitConfigId, setSplitConfigId] = useState('');
  const [amount, setAmount] = useState('100');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState<{ sessionId: string; checkoutUrl: string } | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [customRecipients, setCustomRecipients] = useState<Recipient[]>([
    { address: '', percent: 50, label: '' },
    { address: '', percent: 50, label: '' },
  ]);

  const recipients = customMode ? customRecipients : selected.recipients;
  const totalPercent = recipients.reduce((sum, r) => sum + (r.percent || 0), 0);
  const isValid = totalPercent === 100 && recipients.every(r => r.address.trim());

  const handleCheckout = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount) || 100,
          productName: customMode ? 'Custom Split Payment' : selected.name,
          productDescription: customMode ? 'Revenue split checkout' : selected.desc,
          splitConfigId: splitConfigId.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.sessionId) throw new Error(data.error || 'Failed to create session');
      setSession({ sessionId: data.sessionId, checkoutUrl: data.checkoutUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error creating session');
    } finally {
      setLoading(false);
    }
  };

  const updateCustomRecipient = (i: number, field: keyof Recipient, value: string | number) => {
    setCustomRecipients(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  };

  return (
    <div className="page-container" style={{ maxWidth: '860px', margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ marginBottom: '40px' }}>
        <span style={{ display: 'inline-block', background: 'white', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: '999px', padding: '4px 14px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#FF5C16', marginBottom: '16px' }}>
          Revenue splits demo
        </span>
        <h1 className="page-title" style={{ fontSize: '2.25rem', fontWeight: 900, color: '#180D43', margin: '0 0 10px', letterSpacing: '-0.04em' }}>Revenue Splits</h1>
        <p style={{ color: '#6B7280', fontSize: '15px', margin: 0, lineHeight: 1.6 }}>
          Define a <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 6px', borderRadius: '6px', fontFamily: 'monospace' }}>SplitConfig</code> once, then reference it by ID at checkout. Coal distributes funds to each recipient at settlement.
        </p>
      </div>

      <div className="grid-stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '28px' }}>
        {/* Left: presets or custom */}
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button
              onClick={() => setCustomMode(false)}
              style={{ flex: 1, padding: '8px', borderRadius: '10px', border: `2px solid ${!customMode ? '#FF5C16' : 'rgba(0,0,0,0.08)'}`, background: !customMode ? '#fff5f0' : 'white', fontSize: '12px', fontWeight: 900, cursor: 'pointer', color: !customMode ? '#FF5C16' : '#6B7280' }}
            >
              Presets
            </button>
            <button
              onClick={() => setCustomMode(true)}
              style={{ flex: 1, padding: '8px', borderRadius: '10px', border: `2px solid ${customMode ? '#FF5C16' : 'rgba(0,0,0,0.08)'}`, background: customMode ? '#fff5f0' : 'white', fontSize: '12px', fontWeight: 900, cursor: 'pointer', color: customMode ? '#FF5C16' : '#6B7280' }}
            >
              Custom
            </button>
          </div>

          {!customMode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => { setSelected(preset); setSession(null); }}
                  style={{ background: 'white', border: `2px solid ${selected.id === preset.id ? '#FF5C16' : 'rgba(0,0,0,0.08)'}`, borderRadius: '16px', padding: '14px 16px', textAlign: 'left', cursor: 'pointer', boxShadow: selected.id === preset.id ? '3px 3px 0 0 #FF5C16' : 'none', transition: 'all 0.15s' }}
                >
                  <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 900, color: '#180D43' }}>{preset.name}</p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', fontWeight: 600 }}>{preset.desc}</p>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {customRecipients.map((r, i) => (
                <div key={i} style={{ background: 'white', border: '2px solid rgba(0,0,0,0.06)', borderRadius: '16px', padding: '14px' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      value={r.label}
                      onChange={e => updateCustomRecipient(i, 'label', e.target.value)}
                      placeholder={`Recipient ${i + 1}`}
                      style={{ flex: 1, height: '36px', padding: '0 10px', borderRadius: '8px', border: '1.5px solid rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 700, outline: 'none' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="number"
                        value={r.percent}
                        min={1}
                        max={99}
                        onChange={e => updateCustomRecipient(i, 'percent', parseInt(e.target.value) || 0)}
                        style={{ width: '52px', height: '36px', padding: '0 8px', borderRadius: '8px', border: '1.5px solid rgba(0,0,0,0.1)', fontSize: '13px', fontWeight: 900, textAlign: 'center', outline: 'none' }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: 900, color: '#9CA3AF' }}>%</span>
                    </div>
                  </div>
                  <input
                    value={r.address}
                    onChange={e => updateCustomRecipient(i, 'address', e.target.value)}
                    placeholder="0x wallet address"
                    style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '8px', border: '1.5px solid rgba(0,0,0,0.1)', fontSize: '11px', fontFamily: 'monospace', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
              ))}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setCustomRecipients(prev => [...prev, { address: '', percent: 0, label: '' }])}
                  style={{ flex: 1, padding: '8px', background: 'white', border: '2px dashed rgba(0,0,0,0.1)', borderRadius: '10px', fontSize: '12px', fontWeight: 700, color: '#9CA3AF', cursor: 'pointer' }}
                >
                  + Add recipient
                </button>
                {customRecipients.length > 2 && (
                  <button
                    onClick={() => setCustomRecipients(prev => prev.slice(0, -1))}
                    style={{ padding: '8px 12px', background: 'white', border: '2px solid rgba(220,38,38,0.2)', borderRadius: '10px', fontSize: '12px', fontWeight: 700, color: '#dc2626', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: split visualization + checkout */}
        <div>
          {/* Pie-style split bar */}
          <div style={{ background: 'white', border: '2px solid rgba(0,0,0,0.06)', borderRadius: '20px', padding: '20px', marginBottom: '16px' }}>
            <p style={{ margin: '0 0 14px', fontSize: '12px', fontWeight: 900, color: '#180D43', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Split preview</p>
            <div style={{ height: '12px', borderRadius: '999px', overflow: 'hidden', display: 'flex', marginBottom: '16px', background: 'rgba(0,0,0,0.05)' }}>
              {recipients.map((r, i) => {
                const colors = ['#FF5C16', '#180D43', '#a78bfa', '#22c55e', '#f59e0b'];
                return (
                  <div
                    key={i}
                    style={{ width: `${r.percent}%`, background: colors[i % colors.length], transition: 'width 0.3s' }}
                  />
                );
              })}
            </div>
            {recipients.map((r, i) => {
              const colors = ['#FF5C16', '#180D43', '#a78bfa', '#22c55e', '#f59e0b'];
              const shareAmt = ((parseFloat(amount) || 100) * r.percent / 100).toFixed(2);
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: colors[i % colors.length], flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#180D43' }}>{r.label || `Recipient ${i + 1}`}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '13px', fontWeight: 900, color: '#180D43' }}>{r.percent}%</span>
                    <span style={{ fontSize: '11px', color: '#9CA3AF', marginLeft: '6px' }}>${shareAmt}</span>
                  </div>
                </div>
              );
            })}
            <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', marginTop: '12px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 900, color: totalPercent === 100 ? '#180D43' : '#dc2626' }}>Total: {totalPercent}%</span>
              {totalPercent !== 100 && <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700 }}>Must equal 100%</span>}
            </div>
          </div>

          {/* Amount + split config ID */}
          <div style={{ background: 'white', border: '2px solid rgba(0,0,0,0.06)', borderRadius: '20px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7280', marginBottom: '6px' }}>Amount (USDC)</label>
              <input
                type="number"
                value={amount}
                min="1"
                onChange={e => setAmount(e.target.value)}
                style={{ width: '100%', height: '44px', padding: '0 14px', borderRadius: '12px', border: '2px solid rgba(0,0,0,0.08)', fontSize: '15px', fontWeight: 900, boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7280', marginBottom: '6px' }}>
                Split Config ID <span style={{ color: '#9CA3AF', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>(optional — from your dashboard)</span>
              </label>
              <input
                value={splitConfigId}
                onChange={e => setSplitConfigId(e.target.value)}
                placeholder="cm9x4k... (create one in Coal console)"
                style={{ width: '100%', height: '44px', padding: '0 14px', borderRadius: '12px', border: '2px solid rgba(0,0,0,0.08)', fontSize: '12px', fontFamily: 'monospace', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
          </div>

          {error && <p style={{ color: '#dc2626', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

          {!session ? (
            <button
              onClick={handleCheckout}
              disabled={loading}
              style={{ width: '100%', background: '#000', color: 'white', border: 'none', borderRadius: '14px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '4px 4px 0 0 #FF5C16', transition: 'all 0.15s', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Creating session…' : `Pay $${amount} with splits →`}
            </button>
          ) : (
            <div>
              <div style={{ background: '#f0fdf4', border: '2px solid #86efac', borderRadius: '12px', padding: '14px', marginBottom: '12px' }}>
                <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 900, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.1em' }}>✓ Session ready</p>
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
      </div>

      {/* How splits work */}
      <div className="code-block" style={{ background: '#180D43', borderRadius: '20px', padding: '24px' }}>
        <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>How it works</p>
        <p style={{ margin: '0 0 20px', fontSize: '14px', fontWeight: 700, color: 'white' }}>Create once, reference by ID</p>
        <div className="grid-stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontFamily: 'monospace', fontSize: '11px' }}>
          <div>
            <p style={{ margin: '0 0 8px', color: '#FF5C16', fontWeight: 900 }}>// 1. Create split config</p>
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.8 }}>
              <p style={{ margin: 0 }}>{'POST /api/console/splits'}</p>
              <p style={{ margin: 0 }}>{'{'}</p>
              <p style={{ margin: 0 }}>&nbsp;&nbsp;<span style={{ color: '#a78bfa' }}>name</span>{': "Creator Split",'}</p>
              <p style={{ margin: 0 }}>&nbsp;&nbsp;<span style={{ color: '#a78bfa' }}>recipients</span>{': ['}</p>
              <p style={{ margin: 0 }}>&nbsp;&nbsp;&nbsp;&nbsp;{'{ address: "0x...", percent: 80 },'}</p>
              <p style={{ margin: 0 }}>&nbsp;&nbsp;&nbsp;&nbsp;{'{ address: "0x...", percent: 20 }'}</p>
              <p style={{ margin: 0 }}>&nbsp;&nbsp;{']'}</p>
              <p style={{ margin: 0 }}>{'}'}</p>
            </div>
          </div>
          <div>
            <p style={{ margin: '0 0 8px', color: '#FF5C16', fontWeight: 900 }}>// 2. Reference at checkout</p>
            <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.8 }}>
              <p style={{ margin: 0 }}>{'POST /api/checkouts'}</p>
              <p style={{ margin: 0 }}>{'{'}</p>
              <p style={{ margin: 0 }}>&nbsp;&nbsp;<span style={{ color: '#a78bfa' }}>amount</span>{': 100,'}</p>
              <p style={{ margin: 0 }}>&nbsp;&nbsp;<span style={{ color: '#a78bfa' }}>productName</span>{': "Course",'}</p>
              <p style={{ margin: 0 }}>&nbsp;&nbsp;<span style={{ color: '#a78bfa' }}>splitConfigId</span>{': "cm9x4k..."'}</p>
              <p style={{ margin: 0 }}>{'}'}</p>
              <p style={{ margin: '6px 0 0', color: '#6b7280' }}>{`// Coal distributes on settlement`}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
