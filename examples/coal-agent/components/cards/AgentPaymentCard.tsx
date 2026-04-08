'use client';

export function AgentPaymentCard({ data }: { data: Record<string, unknown> }) {
  const success = data.success as boolean;
  const txHash = data.txHash as string | undefined;
  const amount = data.amount as string | undefined;
  const recipient = data.recipient as string | undefined;
  const purpose = data.purpose as string | undefined;
  const basescanUrl = data.basescanUrl as string | undefined;
  const error = data.error as string | undefined;

  return (
    <div className="border border-black/5 rounded-2xl bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
        <span className="text-sm font-bold text-[var(--brand-navy)]">Agent Payment</span>
        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${
          success
            ? 'bg-green-50 text-green-700 border-green-200'
            : 'bg-red-50 text-red-600 border-red-200'
        }`}>
          {success ? 'Sent' : 'Failed'}
        </span>
      </div>

      <div className="px-4 py-3 text-xs space-y-2">
        {error ? (
          <div className="text-red-600 font-medium">{error}</div>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-black text-[var(--brand-navy)]">
                ${amount} <span className="text-sm font-bold text-[var(--muted)]">USDC</span>
              </span>
              {purpose && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-semibold capitalize">
                  {purpose}
                </span>
              )}
            </div>

            {recipient && (
              <div className="flex justify-between items-center">
                <span className="text-[var(--muted)]">To</span>
                <span className="font-mono text-[var(--brand-navy)] font-medium">
                  {recipient.slice(0, 6)}...{recipient.slice(-4)}
                </span>
              </div>
            )}

            {txHash && (
              <div className="flex justify-between items-center">
                <span className="text-[var(--muted)]">Tx Hash</span>
                <span className="font-mono text-[var(--brand-navy)] font-medium">
                  {txHash.slice(0, 10)}...{txHash.slice(-6)}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {basescanUrl && (
        <a
          href={basescanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block px-4 py-2.5 bg-[var(--accent)]/5 text-center text-[11px] font-bold text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
        >
          View on BaseScan ↗
        </a>
      )}
    </div>
  );
}
