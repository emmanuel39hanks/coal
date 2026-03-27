'use client';

import { isSafeUrl } from '@/lib/types';

export function PaywallCard({ data }: { data: Record<string, unknown> }) {
  const paymentRequired = data.paymentRequired as boolean;
  const requirements = data.paymentRequirements as Record<string, unknown> | undefined;

  return (
    <div className="border border-black/5 rounded-2xl bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
        <span className="text-sm font-bold text-[var(--brand-navy)]">Paywall Check</span>
        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${paymentRequired ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
          {paymentRequired ? 'Payment Required (402)' : 'Access Granted'}
        </span>
      </div>
      <div className="px-4 py-3 text-xs space-y-2">
        {!!data.paywallId && <div className="font-mono text-[10px] text-[var(--muted)]">Paywall: {data.paywallId as string}</div>}
        {paymentRequired && requirements && (
          <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <div className="text-[10px] font-bold text-amber-700 mb-1">x402 Payment Requirements</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
              {!!requirements.maxAmountRequired && <><div className="text-[var(--muted)]">Amount</div><div className="text-[var(--brand-navy)] font-medium">{requirements.maxAmountRequired as string}</div></>}
              {!!requirements.currency && <><div className="text-[var(--muted)]">Currency</div><div className="text-[var(--brand-navy)] font-medium">{(requirements.currency || requirements.asset) as string}</div></>}
              {!!requirements.network && <><div className="text-[var(--muted)]">Network</div><div className="text-[var(--brand-navy)] font-medium">{requirements.network as string}</div></>}
              {!!requirements.receiver && <><div className="text-[var(--muted)]">Receiver</div><div className="font-mono truncate text-[var(--brand-navy)]">{(requirements.receiver || requirements.payTo) as string}</div></>}
            </div>
          </div>
        )}
        {isSafeUrl(data.paymentUrl) && (
          <a
            href={data.paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-2 text-center px-4 py-2.5 rounded-full bg-black text-white text-sm font-bold shadow-coal-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#FF5C16] transition-all duration-200"
          >
            Pay to Access &rarr;
          </a>
        )}
      </div>
    </div>
  );
}
