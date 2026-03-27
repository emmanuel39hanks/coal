'use client';

import { isSafeImageUrl } from '@/lib/types';

export function MerchantProfileCard({ data }: { data: Record<string, unknown> }) {
  const profile = data.profile as Record<string, unknown> | undefined;
  const zeroG = data.zeroG as Record<string, unknown> | undefined;

  if (!profile) return <div className="text-sm text-[var(--error)]">No profile data</div>;

  return (
    <div className="border border-black/5 rounded-2xl bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
        <span className="text-sm font-bold text-[var(--brand-navy)]">Merchant Profile</span>
        {zeroG?.published ? (
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 font-semibold border border-green-200">Published on 0G</span>
        ) : (
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-black/5 text-[var(--muted)] font-semibold">Not published</span>
        )}
      </div>
      <div className="px-4 py-3 text-xs space-y-2">
        <div className="text-lg font-black text-[var(--brand-navy)]">{profile.name as string || 'Unnamed'}</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div className="text-[var(--muted)]">Products</div>
          <div className="text-[var(--brand-navy)] font-medium">{profile.productCount as number}</div>
          <div className="text-[var(--muted)]">Paywalls</div>
          <div className="text-[var(--brand-navy)] font-medium">{profile.paywallCount as number}</div>
          <div className="text-[var(--muted)]">Team</div>
          <div className="text-[var(--brand-navy)] font-medium">{profile.teamSize as number} members</div>
        </div>

        {(profile.topProducts as Array<{ name: string; price: string; image?: string }>)?.length > 0 && (
          <div className="mt-2">
            <div className="text-[var(--muted)] mb-1.5 font-semibold">Products:</div>
            <div className="space-y-2">
              {(profile.topProducts as Array<{ name: string; price: string; image?: string }>).map((p, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-xl bg-[var(--background)]">
                  {isSafeImageUrl(p.image) ? (
                    <img src={p.image} alt={p.name} className="w-10 h-10 rounded-lg object-cover flex-none" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-black/5 flex items-center justify-center flex-none">
                      <span className="text-[var(--muted)] text-lg">&#x1f4e6;</span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-semibold text-[var(--brand-navy)] truncate">{p.name}</div>
                    <div className="text-[var(--muted)]">${p.price} USDC</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-1 flex-wrap mt-2">
          {Object.entries((profile.capabilities || {}) as Record<string, boolean>).filter(([, v]) => v).map(([k]) => (
            <span key={k} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] font-semibold">{k}</span>
          ))}
        </div>

        {!!profile.endpoints && (
          <div className="mt-2 pt-2 border-t border-black/5">
            <div className="text-[var(--muted)] mb-1 font-semibold">Agent Endpoints:</div>
            {Object.entries(profile.endpoints as Record<string, string>).map(([name, url]) => (
              <div key={name} className="font-mono text-[10px] truncate text-[var(--brand-navy)]">{name}: {url}</div>
            ))}
          </div>
        )}
      </div>
      {!!zeroG?.storageUri && (
        <div className="px-4 py-2 bg-[var(--accent)]/5 text-[10px] text-[var(--accent)] font-mono truncate font-semibold">
          0G URI: {zeroG.storageUri as string}
        </div>
      )}
    </div>
  );
}
