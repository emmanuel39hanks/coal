'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useState } from 'react';

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [showMenu, setShowMenu] = useState(false);

  if (isConnected && address) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-black/5 bg-white hover:border-[var(--accent)]/30 transition-colors text-xs"
        >
          <span className="w-2 h-2 rounded-full bg-[var(--success)]" />
          <span className="font-mono font-semibold text-[var(--brand-navy)]">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        </button>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-black/5 rounded-xl shadow-lg p-1 min-w-[140px]">
              <button
                onClick={() => { disconnect(); setShowMenu(false); }}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
              >
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="btn-pill px-4 py-1.5 bg-black text-white text-xs font-bold shadow-coal-sm hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#FF5C16] transition-all duration-200"
      >
        Connect Wallet
      </button>
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-black/5 rounded-xl shadow-lg p-1 min-w-[200px]">
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                onClick={() => { connect({ connector }); setShowMenu(false); }}
                className="w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold text-[var(--brand-navy)] hover:bg-[var(--background)] transition-colors"
              >
                {connector.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
