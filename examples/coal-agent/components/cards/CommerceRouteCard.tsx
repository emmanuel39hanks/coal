'use client';

export function CommerceRouteCard({ data }: { data: Record<string, unknown> }) {
  const route = data.route as Record<string, unknown> | undefined;
  const zeroG = data.zeroG as Record<string, unknown> | undefined;

  return (
    <div className="border border-black/5 rounded-2xl bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
        <span className="text-sm font-bold text-[var(--brand-navy)]">Commerce Route</span>
        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-semibold border border-[var(--accent)]/20">0G Compute</span>
      </div>
      <div className="px-4 py-3 text-xs space-y-2">
        <div className="text-[var(--muted)] font-semibold">Goal: {data.goal as string}</div>
        {route && (
          <>
            <div>
              <span className="text-[var(--muted)]">Surface:</span>{' '}
              <span className="px-2 py-0.5 rounded-full bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] text-[10px] font-semibold">
                {route.recommendedSurface as string}
              </span>
            </div>
            <div className="text-sm text-[var(--brand-navy)]">{route.reason as string}</div>
            {route.targetId && (
              <div className="font-mono text-[10px] text-[var(--brand-navy)]">Target: {route.targetId as string}</div>
            )}
            {route.nextEndpoint && (
              <div className="font-mono text-[10px] text-[var(--accent)] font-semibold">Next: {route.nextEndpoint as string}</div>
            )}
          </>
        )}
      </div>
      {!!zeroG?.memorySource && (
        <div className="px-4 py-2 bg-[var(--accent)]/5 text-[10px] text-[var(--accent)] font-semibold">
          Memory: {zeroG.memorySource as string}
        </div>
      )}
    </div>
  );
}
