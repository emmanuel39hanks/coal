'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract, useSwitchChain } from 'wagmi';
import { parseUnits, parseAbi } from 'viem';
import { base } from 'viem/chains';

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_ABI = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);

// Simple context for parent to read wallet info
export function useAgentWalletContext() { return null; }

/** A signed binding the server issues at wallet creation. Stored alongside walletId
 * so the chat / pay / withdraw routes can verify the client isn't presenting a
 * walletId they didn't earn. Without this, anyone who learns a walletId could
 * drain it (the $5/tx cap doesn't stop iterative draining). */
interface WalletBinding {
  walletId: string;
  address: string;
  signature: string;
}

interface Props {
  onWalletReady?: (wallet: WalletBinding) => void;
}

export function AgentWallet({ onWalletReady }: Props) {
  const { address: userAddress, isConnected } = useAccount();
  const [wallet, setWallet] = useState<{ walletId: string; address: string; signature: string; balance: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [tab, setTab] = useState<'fund' | 'withdraw' | 'info'>('fund');

  const [fundAmount, setFundAmount] = useState('');
  const [funding, setFunding] = useState(false);
  const [fundTxHash, setFundTxHash] = useState<string | null>(null);

  const [withdrawAddr, setWithdrawAddr] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawResult, setWithdrawResult] = useState<{ txHash: string; amount: string } | null>(null);

  const { writeContractAsync } = useWriteContract();
  const { switchChainAsync } = useSwitchChain();

  const fetchWallet = useCallback(async () => {
    try {
      // Check localStorage for existing wallet — must include the server-issued
      // signature, otherwise it's an old client-side record from before the
      // wallet-binding migration and we should mint a fresh wallet.
      const stored = localStorage.getItem('coal_agent_wallet');
      let walletData: WalletBinding | null = null;

      try {
        const parsed = stored ? JSON.parse(stored) : null;
        if (parsed?.walletId && parsed?.address && parsed?.signature) {
          walletData = parsed;
        } else if (parsed?.walletId && parsed?.address) {
          // Old format (pre-2026-05-01 security upgrade). The walletId is real
          // but lacks the HMAC binding. We move it aside so the user can
          // recover funds via support, and mint a fresh wallet.
          localStorage.setItem('coal_agent_wallet_legacy', stored!);
          localStorage.removeItem('coal_agent_wallet');
          // eslint-disable-next-line no-console
          console.warn('[Coal] Migrated legacy wallet entry. Funds in', parsed.address, 'are still in Privy custody — email support@usecoal.xyz to recover.');
        }
      } catch {}

      if (walletData) {
        const res = await fetch(`/api/agent/wallet?walletId=${walletData.walletId}&address=${walletData.address}`);
        if (res.ok) {
          const data = await res.json();
          setWallet({ ...walletData, balance: data.balance || '0' });
          onWalletReady?.(walletData);
          setLoading(false);
          return;
        }
      }

      // No valid binding — create new wallet (server issues fresh signature)
      const res = await fetch('/api/agent/wallet', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.walletId && data.address && data.walletSignature) {
          walletData = { walletId: data.walletId, address: data.address, signature: data.walletSignature };
          localStorage.setItem('coal_agent_wallet', JSON.stringify(walletData));
          setWallet({ ...walletData, balance: data.balance || '0' });
          onWalletReady?.(walletData);
        }
      }
    } catch {} finally { setLoading(false); }
  }, [onWalletReady]);

  useEffect(() => {
    fetchWallet();
    const interval = setInterval(fetchWallet, 10_000);
    return () => clearInterval(interval);
  }, [fetchWallet]);

  useEffect(() => {
    if (userAddress && !withdrawAddr) setWithdrawAddr(userAddress);
  }, [userAddress, withdrawAddr]);

  const handleFund = async () => {
    if (!fundAmount || !wallet || !isConnected) return;
    const amount = parseFloat(fundAmount);
    if (amount <= 0 || amount > 100) return;

    setFunding(true);
    setFundTxHash(null);
    try {
      // Force switch to Base network
      await switchChainAsync({ chainId: base.id }).catch(() => {});

      const hash = await writeContractAsync({
        chainId: base.id,
        address: USDC_ADDRESS as `0x${string}`,
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [wallet.address as `0x${string}`, parseUnits(amount.toFixed(6), 6)],
      });
      setFundTxHash(hash);
      setFundAmount('');
      setTimeout(fetchWallet, 5000);
      setTimeout(fetchWallet, 10000);
    } catch (e) {
      console.error('Fund failed:', e);
    } finally {
      setFunding(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAddr || !wallet || !/^0x[a-fA-F0-9]{40}$/.test(withdrawAddr)) return;
    setWithdrawing(true);
    setWithdrawResult(null);
    try {
      const res = await fetch('/api/agent/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toAddress: withdrawAddr,
          walletId: wallet.walletId,
          walletAddress: wallet.address,
          walletSignature: wallet.signature,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setWithdrawResult({ txHash: data.txHash, amount: data.amount });
        setTimeout(fetchWallet, 5000);
      }
    } catch {} finally { setWithdrawing(false); }
  };

  if (loading || !wallet) return null;

  const shortAddr = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`;
  const bal = parseFloat(wallet.balance).toFixed(2);

  return (
    <div className="relative">
      <button
        onClick={() => { setShowPanel(!showPanel); setTab('fund'); }}
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
          <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-black/5 rounded-2xl shadow-xl w-[340px] overflow-hidden">
            {/* Balance */}
            <div className="p-4 pb-3 border-b border-black/5">
              <div className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-1">Your Agent Wallet</div>
              <div className="text-2xl font-black text-[var(--brand-navy)]">${bal} <span className="text-sm font-bold text-[var(--muted)]">USDC</span></div>
              <div className="text-[10px] text-[var(--muted)] mt-0.5">Base Network · Only you can access this wallet</div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-black/5">
              {(['fund', 'withdraw', 'info'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 text-[11px] font-bold transition-colors ${tab === t ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]' : 'text-[var(--muted)]'}`}
                >{t === 'fund' ? 'Fund Agent' : t === 'withdraw' ? 'Withdraw' : 'Details'}</button>
              ))}
            </div>

            <div className="p-4">
              {/* FUND */}
              {tab === 'fund' && (
                <div className="space-y-3">
                  {!isConnected ? (
                    <p className="text-xs text-[var(--muted)] text-center py-4">Connect your wallet first to fund the agent.</p>
                  ) : (
                    <>
                      <div>
                        <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Amount (USDC)</label>
                        <div className="flex gap-2 mt-1">
                          <input type="number" value={fundAmount} onChange={e => setFundAmount(e.target.value)}
                            placeholder="5.00" min="0.01" step="0.01"
                            className="flex-1 h-10 px-3 rounded-xl border border-black/8 text-sm font-bold outline-none focus:border-[var(--accent)]/40" />
                          <button onClick={handleFund} disabled={funding || !fundAmount || parseFloat(fundAmount) <= 0}
                            className="h-10 px-5 rounded-xl bg-[var(--accent)] text-white text-xs font-bold disabled:opacity-40">
                            {funding ? '...' : 'Fund'}
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {['1', '5', '10'].map(amt => (
                          <button key={amt} onClick={() => setFundAmount(amt)}
                            className="flex-1 py-1.5 rounded-lg border border-black/5 text-[11px] font-bold text-[var(--brand-navy)] hover:border-[var(--accent)]/30">
                            ${amt}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-[var(--muted)]">
                        Sends from your wallet ({userAddress?.slice(0, 6)}...{userAddress?.slice(-4)}) to your agent. Withdraw anytime.
                      </p>
                      {fundTxHash && (
                        <div className="p-2.5 rounded-xl bg-green-50 border border-green-200">
                          <span className="text-[11px] font-bold text-green-700">Funded!</span>
                          <a href={`https://basescan.org/tx/${fundTxHash}`} target="_blank" rel="noopener noreferrer"
                            className="block text-[10px] font-mono text-green-600 truncate hover:underline mt-0.5">{fundTxHash}</a>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* WITHDRAW */}
              {tab === 'withdraw' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Destination</label>
                    <input value={withdrawAddr} onChange={e => setWithdrawAddr(e.target.value)} placeholder="0x..."
                      className="w-full h-10 px-3 mt-1 rounded-xl border border-black/8 text-[11px] font-mono outline-none focus:border-[var(--accent)]/40" />
                  </div>
                  <button onClick={handleWithdraw} disabled={withdrawing || !withdrawAddr || parseFloat(wallet.balance) <= 0}
                    className="w-full h-10 rounded-xl bg-[var(--brand-navy)] text-white text-xs font-bold disabled:opacity-40">
                    {withdrawing ? 'Withdrawing...' : `Withdraw $${bal} USDC`}
                  </button>
                  <p className="text-[10px] text-[var(--muted)]">Sends all remaining USDC back to you. Your money, your control.</p>
                  {withdrawResult && (
                    <div className="p-2.5 rounded-xl bg-green-50 border border-green-200">
                      <span className="text-[11px] font-bold text-green-700">Withdrew ${withdrawResult.amount}</span>
                      <a href={`https://basescan.org/tx/${withdrawResult.txHash}`} target="_blank" rel="noopener noreferrer"
                        className="block text-[10px] font-mono text-green-600 truncate hover:underline mt-0.5">{withdrawResult.txHash}</a>
                    </div>
                  )}
                </div>
              )}

              {/* INFO */}
              {tab === 'info' && (
                <div className="space-y-2.5">
                  <div>
                    <div className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider mb-0.5">Agent Address</div>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--background)]">
                      <span className="text-[10px] font-mono text-[var(--brand-navy)] truncate flex-1">{wallet.address}</span>
                      <button onClick={() => navigator.clipboard.writeText(wallet.address)} className="text-[10px] font-bold text-[var(--accent)] shrink-0">Copy</button>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-700">
                    <span className="font-bold">Your wallet:</span> This agent wallet is unique to you. Fund it, let the agent shop, withdraw anytime. Max $5 per transaction.
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
