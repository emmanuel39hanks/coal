'use client';

export function ReceiptCard({ data }: { data: Record<string, unknown> }) {
  const payment = data.payment as Record<string, unknown> | undefined;
  const proofTrail = data.proofTrail as Record<string, unknown> | undefined;
  const storage = proofTrail?.storage as Record<string, unknown> | undefined;
  const chain = proofTrail?.chain as Record<string, unknown> | undefined;
  const verified = data.verified as boolean;

  return (
    <div className="border border-black/5 rounded-2xl bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
        <span className="text-sm font-bold text-[var(--brand-navy)]">Payment Receipt</span>
        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${verified ? 'bg-green-50 text-green-700 border-green-200' : 'bg-black/5 text-[var(--muted)] border-black/5'}`}>
          {verified ? 'Verified' : data.status as string || 'Pending'}
        </span>
      </div>

      {payment && (
        <div className="px-4 py-3 text-xs space-y-1">
          <div className="text-xl font-black text-[var(--brand-navy)]">{payment.amount as string} {payment.currency as string}</div>
          {!!payment.description && <div className="text-[var(--muted)]">{payment.description as string}</div>}
          {!!payment.txHash && (
            <div className="font-mono text-[10px] truncate text-[var(--brand-navy)]">
              Tx: {payment.txHash as string}
            </div>
          )}
          {!!payment.paidAt && <div className="text-[var(--muted)]">Paid: {payment.paidAt as string}</div>}
        </div>
      )}

      {/* 3-step proof trail */}
      <div className="px-4 py-3 border-t border-black/5">
        <div className="text-[10px] text-[var(--muted)] mb-2 font-bold uppercase tracking-wider">0G Proof Trail</div>
        <div className="flex items-center gap-1 text-[11px]">
          <div className={`flex-1 px-2 py-1.5 rounded-xl text-center border ${payment?.txHash ? 'bg-green-50 text-green-700 border-green-200' : 'bg-black/3 text-[var(--muted)] border-black/5'}`}>
            <div className="font-bold">Base TX</div>
            <div className="text-[9px]">{payment?.txHash ? 'Confirmed' : 'Pending'}</div>
          </div>
          <span className="text-[var(--muted)] font-bold">&rarr;</span>
          <div className={`flex-1 px-2 py-1.5 rounded-xl text-center border ${storage ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20' : 'bg-black/3 text-[var(--muted)] border-black/5'}`}>
            <div className="font-bold">0G Storage</div>
            <div className="text-[9px]">{storage ? 'Published' : 'Pending'}</div>
          </div>
          <span className="text-[var(--muted)] font-bold">&rarr;</span>
          <div className={`flex-1 px-2 py-1.5 rounded-xl text-center border ${chain ? 'bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] border-[var(--brand-blue)]/20' : 'bg-black/3 text-[var(--muted)] border-black/5'}`}>
            <div className="font-bold">0G Chain</div>
            <div className="text-[9px]">{chain ? 'Anchored' : 'Pending'}</div>
          </div>
        </div>
      </div>

      {storage && (() => {
        const uri = storage.storageUri as string;
        const explorer = storage.explorerUrl as string | undefined;
        return (
          <div className="px-4 py-2 text-[10px] space-y-0.5 border-t border-black/5">
            <div className="font-mono truncate text-[var(--brand-navy)]"><span className="text-[var(--muted)]">Storage URI:</span> {uri}</div>
            {explorer && <div className="font-mono truncate text-[var(--brand-navy)]"><span className="text-[var(--muted)]">StorageScan:</span> {explorer}</div>}
          </div>
        );
      })()}
      {chain && (() => {
        const anchorHash = chain.anchorTxHash as string;
        const explorer = chain.explorerUrl as string | undefined;
        return (
          <div className="px-4 py-2 text-[10px] space-y-0.5 border-t border-black/5">
            <div className="font-mono truncate text-[var(--brand-navy)]"><span className="text-[var(--muted)]">Anchor TX:</span> {anchorHash}</div>
            {explorer && <div className="font-mono truncate text-[var(--brand-navy)]"><span className="text-[var(--muted)]">ChainScan:</span> {explorer}</div>}
          </div>
        );
      })()}
      {(() => {
        const cid = data.checkoutId as string | undefined;
        return cid ? (
          <a
            href={`https://www.usecoal.xyz/verify/${cid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-4 py-2.5 bg-[var(--accent)]/5 text-center text-[11px] font-bold text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors border-t border-black/5"
          >
            View full receipt on Coal ↗
          </a>
        ) : null;
      })()}
    </div>
  );
}
