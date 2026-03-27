'use client';

export function PolicyEvalCard({ data }: { data: Record<string, unknown> }) {
  const evaluation = data.evaluation as Record<string, unknown> | undefined;
  const zeroG = data.zeroG as Record<string, unknown> | undefined;
  const decision = (evaluation?.decision as string)?.toUpperCase() || 'UNKNOWN';

  const decisionColor = {
    ALLOW: 'bg-green-50 text-green-700 border-green-200',
    DENY: 'bg-red-50 text-red-700 border-red-200',
    REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  }[decision] || 'bg-black/5 text-[var(--muted)] border-black/5';

  return (
    <div className="border border-black/5 rounded-2xl bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
        <span className="text-sm font-bold text-[var(--brand-navy)]">Policy Evaluation</span>
        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[var(--brand-lavender)]/10 text-[var(--brand-lavender)] font-semibold border border-[var(--brand-lavender)]/20">
          0G Sealed Inference
        </span>
      </div>
      <div className="px-4 py-3 text-xs space-y-2">
        <div className="text-[var(--muted)] font-semibold">Scenario: {data.scenario as string}</div>
        <div className={`inline-block px-3 py-1.5 rounded-full border text-sm font-black ${decisionColor}`}>
          {decision}
        </div>
        <div className="text-sm leading-relaxed text-[var(--brand-navy)]">{evaluation?.rationale as string}</div>
        {(evaluation?.nextActions as string[])?.length > 0 && (
          <div>
            <div className="text-[var(--muted)] mb-1 font-semibold">Next actions:</div>
            {(evaluation?.nextActions as string[]).map((a, i) => (
              <div key={i} className="ml-2 text-[11px] text-[var(--brand-navy)]">- {a}</div>
            ))}
          </div>
        )}
      </div>
      {!!zeroG?.memorySource && (
        <div className="px-4 py-2 bg-[var(--brand-lavender)]/5 text-[10px] text-[var(--brand-lavender)] flex items-center gap-1.5 font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-lavender)]" />
          Sealed Inference via TEE — model never sees raw merchant data
        </div>
      )}
    </div>
  );
}
