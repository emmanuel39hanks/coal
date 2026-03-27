'use client';

import { useState, useEffect, useRef } from 'react';

type WebhookEvent = {
  id: string;
  type: string;
  receivedAt: string;
  valid: boolean;
  payload: any;
};

const EVENT_COLORS: Record<string, string> = {
  'checkout.session.completed': '#22c55e',
  'checkout.session.expired': '#ef4444',
  'subscription.renewed': '#a78bfa',
  'subscription.renewal_failed': '#f97316',
  'paywall.access.granted': '#06b6d4',
};

export default function WebhookPage() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<WebhookEvent | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setWebhookUrl(`${window.location.origin}/api/webhook`);
    }
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/webhook');
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch {}
  };

  const startPolling = () => {
    if (pollRef.current) return;
    pollRef.current = setInterval(fetchEvents, 2000);
    setLoading(true);
    setTimeout(() => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setLoading(false);
      }
    }, 60000);
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setLoading(false);
  };

  const sendTest = async () => {
    setTestSending(true);
    try {
      await fetch('/api/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-coal-signature': 'test' },
        body: JSON.stringify({
          type: 'checkout.session.completed',
          data: {
            id: `sess_test_${Date.now()}`,
            amount: 29.99,
            currency: 'USDC',
            status: 'completed',
            productName: 'Pro Plan',
            payer: { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
            txHash: `0x${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`,
            createdAt: new Date().toISOString(),
          },
        }),
      });
      setTimeout(fetchEvents, 500);
    } finally {
      setTestSending(false);
    }
  };

  const clearEvents = async () => {
    await fetch('/api/webhook-events', { method: 'DELETE' }).catch(() => {});
    setEvents([]);
    setSelectedEvent(null);
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '960px', margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ marginBottom: '36px' }}>
        <span style={{ display: 'inline-block', background: 'white', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: '999px', padding: '4px 14px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#FF5C16', marginBottom: '16px' }}>
          Webhooks demo
        </span>
        <h1 className="page-title" style={{ fontSize: '2.25rem', fontWeight: 900, color: '#180D43', margin: '0 0 10px', letterSpacing: '-0.04em' }}>Webhook Events</h1>
        <p style={{ color: '#6B7280', fontSize: '15px', margin: 0, lineHeight: 1.6 }}>
          Coal sends HMAC-SHA256 signed events to your endpoint. Register this URL in your dashboard and complete a checkout to see live events.
        </p>
      </div>

      {/* Webhook URL + controls */}
      <div style={{ background: 'white', border: '2px solid rgba(0,0,0,0.06)', borderRadius: '20px', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7280', marginBottom: '6px' }}>Your webhook endpoint</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f9fafb', border: '2px solid rgba(0,0,0,0.06)', borderRadius: '12px', padding: '10px 14px' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '13px', color: '#180D43', fontWeight: 700, wordBreak: 'break-all' }}>{webhookUrl}</span>
              <button
                onClick={() => navigator.clipboard.writeText(webhookUrl)}
                style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#9CA3AF' }}
                title="Copy"
              >
                📋
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            {!loading ? (
              <button
                onClick={startPolling}
                style={{ height: '44px', background: '#000', color: 'white', border: 'none', borderRadius: '12px', padding: '0 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', boxShadow: '3px 3px 0 0 #FF5C16' }}
              >
                ● Listen
              </button>
            ) : (
              <button
                onClick={stopPolling}
                style={{ height: '44px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '12px', padding: '0 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >
                ■ Stop
              </button>
            )}
            <button
              onClick={sendTest}
              disabled={testSending}
              style={{ height: '44px', background: 'white', color: '#180D43', border: '2px solid rgba(0,0,0,0.08)', borderRadius: '12px', padding: '0 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: testSending ? 0.6 : 1 }}
            >
              {testSending ? '…' : '⚡ Test event'}
            </button>
            {events.length > 0 && (
              <button
                onClick={clearEvents}
                style={{ height: '44px', background: 'white', color: '#9CA3AF', border: '2px solid rgba(0,0,0,0.06)', borderRadius: '12px', padding: '0 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {loading && (
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', animation: 'pulse 1.5s infinite' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#166534' }}>Listening for events… polling every 2s</span>
          </div>
        )}
      </div>

      <div className="grid-stack-mobile" style={{ display: 'grid', gridTemplateColumns: selectedEvent ? '1fr 1fr' : '1fr', gap: '20px' }}>
        {/* Event list */}
        <div style={{ background: '#180D43', borderRadius: '20px', overflow: 'hidden', minHeight: '400px' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 900, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Event feed
            </span>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.3)' }}>
              {events.length} event{events.length !== 1 ? 's' : ''}
            </span>
          </div>

          {events.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔔</div>
              <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', fontWeight: 600, margin: 0 }}>
                No events yet. Click "Listen" then send a test or complete a checkout.
              </p>
            </div>
          ) : (
            <div style={{ padding: '12px' }}>
              {events.map(event => {
                const color = EVENT_COLORS[event.type] || '#9CA3AF';
                const isSelected = selectedEvent?.id === event.id;
                return (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEvent(isSelected ? null : event)}
                    style={{ width: '100%', background: isSelected ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '12px', padding: '12px 14px', textAlign: 'left', cursor: 'pointer', marginBottom: '6px', transition: 'all 0.15s' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                          <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, color: color }}>{event.type}</span>
                        </div>
                        {event.payload?.data?.productName && (
                          <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, paddingLeft: '16px' }}>
                            {event.payload.data.productName}
                            {event.payload.data.amount && ` · $${event.payload.data.amount}`}
                          </p>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '12px' }}>
                        <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>{formatTime(event.receivedAt)}</p>
                        {!event.valid && <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#ef4444', fontWeight: 700 }}>SIG INVALID</p>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Event detail */}
        {selectedEvent && (
          <div style={{ background: 'white', border: '2px solid rgba(0,0,0,0.06)', borderRadius: '20px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: 900, color: '#180D43' }}>{selectedEvent.type}</p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#9CA3AF', fontFamily: 'monospace' }}>{formatTime(selectedEvent.receivedAt)}</p>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '10px', fontWeight: 900, background: selectedEvent.valid ? '#dcfce7' : '#fee2e2', color: selectedEvent.valid ? '#166534' : '#dc2626' }}>
                  {selectedEvent.valid ? '✓ Signature valid' : '✕ Invalid sig'}
                </span>
                <button onClick={() => setSelectedEvent(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '16px', lineHeight: 1 }}>×</button>
              </div>
            </div>
            <pre style={{ margin: 0, padding: '16px 20px', fontSize: '11px', fontFamily: 'monospace', color: '#374151', lineHeight: 1.7, overflowX: 'auto', overflowY: 'auto', maxHeight: '500px', background: '#f9fafb' }}>
              {JSON.stringify(selectedEvent.payload, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Verification code */}
      <div className="code-block" style={{ marginTop: '28px', background: '#180D43', borderRadius: '20px', padding: '24px' }}>
        <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>Signature Verification</p>
        <p style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 700, color: 'white' }}>HMAC-SHA256 — verify every event server-side</p>
        <pre style={{ margin: 0, background: 'rgba(255,255,255,0.05)', borderRadius: '14px', padding: '18px', fontSize: '11px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, overflowX: 'auto' }}>
{`import crypto from 'crypto';

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// In your webhook handler:
const sig = req.headers['x-coal-signature'];
const raw = await req.text();
if (!verifyWebhookSignature(raw, sig, process.env.COAL_WEBHOOK_SECRET)) {
  return Response.json({ error: 'Invalid signature' }, { status: 401 });
}`}
        </pre>
      </div>
    </div>
  );
}
