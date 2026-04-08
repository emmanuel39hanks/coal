'use client';

import { useState, useEffect, useCallback } from 'react';

export function AgentWallet() {
  const [wallet, setWallet] = useState<{ address: string; balance: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [withdrawAddr, setWithdrawAddr] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawResult, setWithdrawResult] = useState<{ txHash: string; amount: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchWallet = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/wallet');
      if (res.ok) {
        const data = await res.json();
        setWallet({ address: data.address, balance: data.balance });
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWallet();
    const interval = setInterval(fetchWallet, 10_000);
    return () => clearInterval(interval);
  }, [fetchWallet]);

  const handleCopy = async () => {
    if (!wallet) return;
    await navigator.clipboard.writeText(wallet.address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWithdraw = async () => {
    if (!withdrawAddr || !/^0x[a-fA-F0-9]{40}$/.test(withdrawAddr)) return;
    setWithdrawing(true);
    setWithdrawResult(null);
    try {
      const res = await fetch('/api/agent/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toAddress: withdrawAddr }),
      });
      const data = await res.json();
      if (data.success) {
        setWithdrawResult({ txHash: data.txHash, amount: data.amount });
        fetchWallet();
      }
    } catch {
      // Silent
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading || !wallet) return null;

  const shortAddr = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
  const bal = parseFloat(wallet.balance).toFixed(2);

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-black/5 bg-white hover:border-[var(--accent)]/30 transition-colors text-xs"
      >
        <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
        <span className="font-mono font-semibold text-[var(--brand-navy)]">{shortAddr}</span>
        <span className="text-[var(--muted)]">·</span>
        <span className="font-bold text-[var(--brand-navy)]">${bal}</span>
        <span className="text-[var(--muted)] text-[10px]">USDC</span>
      </button>

      {showPanel && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowPanel(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-black/5 rounded-2xl shadow-lg p-4 w-[320px]">
            <div className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-2">Agent Wallet</div>

            {/* Balance */}
            <div className="text-2xl font-black text-[var(--brand-navy)] mb-1">${bal} <span className="text-sm font-bold text-[var(--muted)]">USDC</span></div>
            <div className="text-[10px] text-[var(--muted)] mb-4">Base Network</div>

            {/* Address + Copy */}
            <div className="flex items-center gap-2 mb-4 p-2.5 rounded-xl bg-[var(--background)] border border-black/5">
              <span className="text-[11px] font-mono text-[var(--brand-navy)] truncate flex-1">{wallet.address}</span>
              <button
                onClick={handleCopy}
                className="text-[10px] font-bold text-[var(--accent)] hover:underline shrink-0"
              >
                {copied ? '✓' : 'Copy'}
              </button>
            </div>

            {/* Fund instructions */}
            <div className="text-[11px] text-[var(--muted)] mb-4 p-2.5 rounded-xl bg-amber-50 border border-amber-200">
              <span className="font-bold text-amber-700">Fund:</span> Send USDC on Base to the address above. Balance updates automatically.
            </div>

            {/* Withdraw */}
            <div className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1.5">Withdraw</div>
            <div className="flex gap-2 mb-2">
              <input
                value={withdrawAddr}
                onChange={e => setWithdrawAddr(e.target.value)}
                placeholder="0x destination address"
                className="flex-1 h-9 px-3 rounded-xl border border-black/5 text-[11px] font-mono outline-none focus:border-[var(--accent)]/30"
              />
              <button
                onClick={handleWithdraw}
                disabled={withdrawing || !withdrawAddr}
                className="h-9 px-4 rounded-xl bg-[var(--brand-navy)] text-white text-[11px] font-bold disabled:opacity-40"
              >
                {withdrawing ? '...' : 'Send'}
              </button>
            </div>

            {withdrawResult && (
              <div className="text-[11px] p-2.5 rounded-xl bg-green-50 border border-green-200">
                <span className="font-bold text-green-700">Sent ${withdrawResult.amount} USDC</span>
                <a
                  href={`https://basescan.org/tx/${withdrawResult.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-[10px] font-mono text-green-600 truncate hover:underline mt-0.5"
                >
                  {withdrawResult.txHash}
                </a>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
