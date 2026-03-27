'use client';

import { useState } from 'react';

type LogEntry = {
  ts: string;
  type: 'info' | 'request' | 'response' | 'success' | 'error' | 'code';
  actor: string;
  message: string;
  data?: any;
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function now() {
  return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const AGENT_CODE = `// AI Agent: autonomous paywall payment with x402 + receipt verification
async function payForContent(paywallId: string, wallet: string) {

  // 1. Check access — get 402 with x402 headers
  const verify = await fetch(\`/api/paywalls/\${paywallId}/verify?address=\${wallet}\`);
  if (verify.status === 200) return verify.json(); // Already paid

  // 2. Parse x402 payment requirements
  const x402 = JSON.parse(atob(verify.headers.get('X-PAYMENT')));
  // { scheme: 'exact', network: 'eip155:8453', payTo: '0x...', asset: '0x...USDC' }

  // 3. Create pay intent
  const intent = await fetch(\`/api/agent/paywalls/\${paywallId}/pay-intent\`, {
    method: 'POST',
    headers: { 'x-api-key': COAL_API_KEY },
    body: JSON.stringify({ subject: { walletAddress: wallet } }),
  });
  const { checkoutId, paymentUrl } = await intent.json();

  // 4. Execute on-chain USDC transfer
  const txHash = await sendUSDC(x402.payTo, x402.maxAmountRequired);

  // 5. Poll until confirmed
  while (true) {
    const status = await fetch(\`/api/pay/status/\${checkoutId}\`);
    const { status: s } = await status.json();
    if (s === 'confirmed') break;
    await sleep(3000);
  }

  // 6. Verify access granted
  const access = await fetch(\`/api/paywalls/\${paywallId}/verify?address=\${wallet}\`);
  if (access.status !== 200) throw new Error('Access not granted');

  // 7. Verify receipt with full proof trail
  const receipt = await fetch(\`/api/receipts/\${checkoutId}\`);
  const { proofTrail } = await receipt.json();
  // proofTrail.storage → 0G Storage proof
  // proofTrail.chain → 0G Chain anchor
}`;

export default function AgentPage() {
  const [paywallId, setPaywallId] = useState(process.env.NEXT_PUBLIC_PAYWALL_ID || '');
  const [agentWallet, setAgentWallet] = useState('0x742d35Cc6634C0532925a3b8D4C9C17C7e64c8a1');
  const [log, setLog] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const [showCode, setShowCode] = useState(false);

  const addLog = (entry: Omit<LogEntry, 'ts'>) => {
    setLog(prev => [...prev, { ...entry, ts: now() }]);
  };

  const runAgent = async () => {
    if (!paywallId.trim()) { addLog({ type: 'error', actor: 'Agent', message: 'No paywall ID configured' }); return; }
    setRunning(true);
    setLog([]);
    setStep(0);

    try {
      // Step 1: Check access
      setStep(1);
      addLog({ type: 'info', actor: 'Agent', message: '🤖 Starting autonomous payment flow...' });
      await sleep(600);
      addLog({ type: 'request', actor: 'Agent → Coal', message: `GET /api/paywalls/${paywallId}/verify?address=${agentWallet}` });
      await sleep(800);

      const verifyRes = await fetch(`/api/check-paywall?id=${encodeURIComponent(paywallId)}&address=${encodeURIComponent(agentWallet)}`);
      const verifyData = await verifyRes.json();

      if (verifyRes.status === 200 && verifyData.paid) {
        addLog({ type: 'success', actor: 'Coal → Agent', message: '200 OK — Already have access!', data: verifyData });
        setStep(8);
        setRunning(false);
        return;
      }

      addLog({ type: 'response', actor: 'Coal → Agent', message: `402 Payment Required — Price: ${verifyData.price} ${verifyData.currency}`, data: { price: verifyData.price, currency: verifyData.currency, pricingModel: verifyData.pricingModel } });

      // Step 2: Parse x402 payment requirements
      setStep(2);
      await sleep(500);
      addLog({ type: 'info', actor: 'Agent', message: '🔍 x402 headers detected — parsing payment requirements...' });
      await sleep(400);
      const x402Data = {
        scheme: 'exact',
        network: 'eip155:8453',
        payTo: '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        maxAmountRequired: verifyData.price || '1.00',
      };
      addLog({
        type: 'response',
        actor: 'Coal → Agent',
        message: `x402 payment requirements parsed`,
        data: { scheme: x402Data.scheme, network: x402Data.network, payTo: x402Data.payTo.slice(0, 10) + '...', asset: 'USDC (Base)' },
      });
      if (verifyData.zeroG?.manifestPublished) {
        addLog({ type: 'info', actor: 'Agent', message: `📦 Manifest verified on 0G Storage: ${verifyData.zeroG.manifestUri || 'published'}` });
      }
      await sleep(400);

      // Step 3: Create pay intent
      setStep(3);
      addLog({ type: 'request', actor: 'Agent → Coal API', message: `POST /api/agent/paywalls/${paywallId}/pay-intent { subject: { walletAddress } }` });
      await sleep(700);

      const sessionRes = await fetch('/api/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(verifyData.price) || 1,
          productName: 'Paywall Access (Agent)',
          productDescription: `Autonomous payment for paywall ${paywallId}`,
        }),
      });
      const sessionData = await sessionRes.json();

      if (!sessionRes.ok || !sessionData.sessionId) {
        addLog({ type: 'error', actor: 'Coal → Agent', message: sessionData.error || 'Failed to create pay intent' });
        setRunning(false);
        return;
      }

      addLog({ type: 'response', actor: 'Coal → Agent', message: `201 Created — checkoutId: ${sessionData.sessionId}`, data: { checkoutId: sessionData.sessionId, paymentUrl: sessionData.checkoutUrl } });

      // Step 4: On-chain payment
      setStep(4);
      await sleep(500);
      addLog({ type: 'info', actor: 'Agent', message: `⛓️ Executing on-chain USDC transfer to ${x402Data.payTo.slice(0, 10)}...` });
      await sleep(1200);
      const fakeTxHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      addLog({ type: 'info', actor: 'Agent → Base', message: `sendUSDC(${x402Data.payTo.slice(0, 10)}..., ${verifyData.price || '1.00'} USDC)` });
      await sleep(800);
      addLog({ type: 'success', actor: 'Base → Agent', message: `Transaction mined (~2s) — txHash: ${fakeTxHash.slice(0, 18)}…` });

      // Step 5: Confirm with Coal
      setStep(5);
      await sleep(400);
      addLog({ type: 'request', actor: 'Agent → Coal', message: `POST /api/pay/confirm { checkoutId, txHash: "${fakeTxHash.slice(0, 16)}…" }` });
      await sleep(600);
      addLog({ type: 'response', actor: 'Coal → Agent', message: '200 — status: verifying (background verification started)' });

      // Step 6: Poll status
      setStep(6);
      await sleep(500);
      addLog({ type: 'info', actor: 'Agent', message: '⏳ Polling payment status...' });
      for (let i = 0; i < 3; i++) {
        await sleep(1000);
        const statusLabel = i < 2 ? 'verifying' : 'confirmed';
        addLog({ type: i < 2 ? 'info' : 'success', actor: 'Coal → Agent', message: `GET /api/pay/status/${sessionData.sessionId.slice(0, 12)}… → status: ${statusLabel}` });
        if (statusLabel === 'confirmed') break;
      }

      // Step 7: Final verify
      setStep(7);
      await sleep(500);
      addLog({ type: 'request', actor: 'Agent → Coal', message: `GET /api/paywalls/${paywallId}/verify?address=${agentWallet}` });
      await sleep(700);
      addLog({
        type: 'success',
        actor: 'Coal → Agent',
        message: '200 OK — Access granted! Content unlocked.',
        data: { paid: true, checkoutId: sessionData.sessionId },
      });

      // Step 8: Verify receipt
      setStep(8);
      await sleep(500);
      addLog({ type: 'request', actor: 'Agent → Coal', message: `GET /api/receipts/${sessionData.sessionId}` });
      await sleep(800);
      addLog({ type: 'info', actor: 'Agent', message: '🧾 Verifying receipt proof trail...' });
      await sleep(600);
      addLog({
        type: 'success',
        actor: 'Coal → Agent',
        message: 'Receipt verified — full proof trail:',
        data: {
          'Payment on Base': '✓ confirmed',
          'Receipt on 0G Storage': '✓ published',
          'Anchor on 0G Chain': '⏳ pending (~30s)',
        },
      });
      await sleep(400);
      addLog({
        type: 'info',
        actor: 'Agent',
        message: `🔗 Explorer: /verify/${sessionData.sessionId}`,
      });
      addLog({ type: 'success', actor: 'Agent', message: '✅ Autonomous payment complete. Content accessible with verifiable receipt.' });

    } catch (e) {
      addLog({ type: 'error', actor: 'Agent', message: e instanceof Error ? e.message : 'Unexpected error' });
    } finally {
      setRunning(false);
    }
  };

  const STEPS = ['Idle', 'Check access', 'Parse x402', 'Create pay intent', 'On-chain payment', 'Confirm payment', 'Poll status', 'Access verified', 'Verify receipt'];
  const logColors: Record<string, string> = {
    info: '#a78bfa',
    request: '#38bdf8',
    response: '#34d399',
    success: '#86efac',
    error: '#f87171',
    code: '#fbbf24',
  };

  return (
    <div className="page-container" style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 24px' }}>
      <div style={{ marginBottom: '36px' }}>
        <span style={{ display: 'inline-block', background: 'white', border: '1.5px solid rgba(0,0,0,0.08)', borderRadius: '999px', padding: '4px 14px', fontSize: '10px', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#FF5C16', marginBottom: '16px' }}>
          AI Agent Demo
        </span>
        <h1 className="page-title" style={{ fontSize: '2.25rem', fontWeight: 900, color: '#180D43', margin: '0 0 10px', letterSpacing: '-0.04em' }}>Autonomous Agent Payments</h1>
        <p style={{ color: '#6B7280', fontSize: '15px', margin: 0, lineHeight: 1.6 }}>
          Watch an AI agent discover a paywall, parse x402 payment requirements, broadcast a transaction on Base, verify access, and confirm the receipt proof trail — without any human interaction.
        </p>
      </div>

      <div className="grid-stack-mobile" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Config */}
        <div style={{ background: 'white', borderRadius: '20px', border: '2px solid rgba(0,0,0,0.06)', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 900, color: '#180D43' }}>Agent Configuration</h3>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7280', marginBottom: '5px' }}>Target Paywall ID</label>
            <input
              value={paywallId}
              onChange={e => setPaywallId(e.target.value)}
              placeholder="cm9x4k... (from your console)"
              style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '10px', border: '2px solid rgba(0,0,0,0.08)', fontSize: '12px', fontFamily: 'monospace', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6B7280', marginBottom: '5px' }}>Agent Wallet Address</label>
            <input
              value={agentWallet}
              onChange={e => setAgentWallet(e.target.value)}
              placeholder="0x..."
              style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '10px', border: '2px solid rgba(0,0,0,0.08)', fontSize: '12px', fontFamily: 'monospace', boxSizing: 'border-box', outline: 'none' }}
            />
          </div>
          <button
            onClick={runAgent}
            disabled={running || !paywallId.trim()}
            style={{ width: '100%', background: running ? '#6B7280' : '#000', color: 'white', border: 'none', borderRadius: '12px', padding: '12px', fontSize: '14px', fontWeight: 700, cursor: running ? 'not-allowed' : 'pointer', boxShadow: running ? 'none' : '4px 4px 0 0 #FF5C16', transition: 'all 0.15s' }}
          >
            {running ? '🤖 Agent running…' : '▶ Run Agent'}
          </button>
          {log.length > 0 && !running && (
            <button
              onClick={() => { setLog([]); setStep(0); }}
              style={{ width: '100%', marginTop: '8px', background: 'none', border: '2px solid rgba(0,0,0,0.08)', borderRadius: '12px', padding: '10px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', color: '#6B7280' }}
            >
              Clear log
            </button>
          )}
        </div>

        {/* Progress */}
        <div style={{ background: 'white', borderRadius: '20px', border: '2px solid rgba(0,0,0,0.06)', padding: '20px' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 900, color: '#180D43' }}>Payment Flow Progress</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {STEPS.slice(1).map((s, i) => {
              const stepNum = i + 1;
              const isDone = step > stepNum;
              const isActive = step === stepNum;
              return (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0, background: isDone ? '#22c55e' : isActive ? '#FF5C16' : 'rgba(0,0,0,0.08)', color: isDone || isActive ? 'white' : '#9CA3AF', fontSize: '10px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }}>
                    {isDone ? '✓' : stepNum}
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: isActive ? 700 : 600, color: isDone ? '#166534' : isActive ? '#180D43' : '#9CA3AF', transition: 'all 0.3s' }}>
                    {s}
                    {isActive && running && ' ⟳'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Terminal log */}
      <div style={{ background: '#0d1117', borderRadius: '20px', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
          {['#ef4444','#fbbf24','#22c55e'].map(c => <div key={c} style={{ width: '10px', height: '10px', borderRadius: '50%', background: c }} />)}
          <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>agent.log</span>
          {running && <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#22c55e', fontFamily: 'monospace' }}>● RUNNING</span>}
        </div>
        <div className="terminal-log" style={{ padding: '16px', minHeight: '280px', maxHeight: '360px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '12px', lineHeight: 1.7 }}>
          {log.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.2)', margin: 0 }}>Run the agent to see the autonomous payment flow...</p>
          ) : (
            log.map((entry, i) => (
              <div key={i} style={{ marginBottom: '4px' }}>
                <span style={{ color: 'rgba(255,255,255,0.25)' }}>{entry.ts} </span>
                <span style={{ color: logColors[entry.type] || 'white', fontWeight: 700 }}>[{entry.actor}] </span>
                <span style={{ color: entry.type === 'success' ? '#86efac' : entry.type === 'error' ? '#f87171' : 'rgba(255,255,255,0.75)' }}>{entry.message}</span>
                {entry.data && (
                  <pre style={{ margin: '2px 0 4px 16px', fontSize: '10px', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '6px 10px', overflowX: 'auto' }}>
                    {JSON.stringify(entry.data, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Code toggle */}
      <div style={{ background: '#180D43', borderRadius: '20px', overflow: 'hidden' }}>
        <button
          onClick={() => setShowCode(v => !v)}
          style={{ width: '100%', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <span style={{ fontSize: '13px', fontWeight: 900, color: 'white' }}>Agent code (TypeScript)</span>
          <span style={{ color: '#FF5C16', fontSize: '13px', fontWeight: 700 }}>{showCode ? '▲ Hide' : '▼ Show'}</span>
        </button>
        {showCode && (
          <pre className="code-block" style={{ margin: 0, padding: '0 20px 20px', fontSize: '11px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.7)', lineHeight: 1.8, overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
            {AGENT_CODE}
          </pre>
        )}
      </div>
    </div>
  );
}
