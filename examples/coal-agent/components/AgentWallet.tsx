'use client';

import { useState, useEffect, useCallback } from 'react';

export function AgentWallet() {
  const [wallet, setWallet] = useState<{ address: string; balance: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWallet = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/wallet');
      if (res.ok) {
        const data = await res.json();
        setWallet({ address: data.address, balance: data.balance });
      }
    } catch {
      // Silent fail — wallet display is optional
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWallet();
    const interval = setInterval(fetchWallet, 10_000);
    return () => clearInterval(interval);
  }, [fetchWallet]);

  if (loading || !wallet) return null;

  const shortAddr = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
  const bal = parseFloat(wallet.balance).toFixed(2);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-black/5 bg-white text-xs">
      <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
      <span className="font-mono font-semibold text-[var(--brand-navy)]">{shortAddr}</span>
      <span className="text-[var(--muted)]">·</span>
      <span className="font-bold text-[var(--brand-navy)]">${bal}</span>
      <span className="text-[var(--muted)] text-[10px]">USDC</span>
    </div>
  );
}
