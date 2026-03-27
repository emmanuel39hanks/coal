'use client';

export function MemoryQueryCard({ data }: { data: Record<string, unknown> }) {
  const response = data.response as Record<string, unknown> | undefined;
  const zeroG = data.zeroG as Record<string, unknown> | undefined;

  return (
    <div className="border border-black/5 rounded-2xl bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
        <span className="text-sm font-bold text-[var(--brand-navy)]">Memory Query</span>
        <div className="flex gap-1">
          {!!zeroG?.sealedInference && (
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[var(--brand-lavender)]/10 text-[var(--brand-lavender)] font-semibold border border-[var(--brand-lavender)]/20">Sealed Inference (TEE)</span>
          )}
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-semibold border border-[var(--accent)]/20">
            {(data.source as string) || '0G Compute'}
          </span>
        </div>
      </div>
      <div className="px-4 py-3 text-xs space-y-2">
        <div className="text-[var(--muted)] font-semibold">Query: {data.query as string}</div>
        <div className="text-sm leading-relaxed text-[var(--brand-navy)]">{response?.answer as string}</div>
        {(response?.citations as string[])?.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {(response?.citations as string[]).map((c, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/5 text-[var(--muted)] font-mono font-semibold">{c}</span>
            ))}
          </div>
        )}
        {(response?.recommendedActions as string[])?.length > 0 && (
          <div>
            <div className="text-[var(--muted)] mb-1 font-semibold">Actions:</div>
            {(response?.recommendedActions as string[]).map((a, i) => (
              <div key={i} className="ml-2 text-[11px] text-[var(--brand-navy)]">- {a}</div>
            ))}
          </div>
        )}
      </div>
      {!!zeroG?.memorySource && (
        <div className="px-4 py-2 bg-[var(--accent)]/5 text-[10px] text-[var(--accent)] flex items-center gap-1.5 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
          Memory: {zeroG.memorySource as string}
          {!!zeroG.storageUri && <span className="font-mono ml-1">| {zeroG.storageUri as string}</span>}
        </div>
      )}
    </div>
  );
}
