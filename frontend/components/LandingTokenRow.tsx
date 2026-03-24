'use client';

import { Icon } from '@iconify/react';

const TOKENS = [
  { label: 'ETH', icon: 'cryptocurrency-color:eth' },
  { label: 'USDC', icon: 'cryptocurrency-color:usdc' },
  { label: 'USDT', icon: 'cryptocurrency-color:usdt' },
  { label: 'DAI', icon: 'cryptocurrency-color:dai' },
  { label: 'WBTC', icon: 'cryptocurrency-color:wbtc' },
] as const;

function TokenBadge({
  label,
  icon,
}: {
  label: string;
  icon: string;
}) {
  return (
    <div className="inline-flex h-14 items-center gap-3 rounded-full border border-[var(--color-brand-navy)]/10 bg-white/88 px-4 pr-5 text-sm font-black tracking-tight text-[var(--color-brand-navy)] shadow-[0_12px_28px_rgba(24,13,67,0.08)] ring-1 ring-white/70 backdrop-blur-sm">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-base)]/90 ring-1 ring-black/5">
        <Icon icon={icon} className="h-5 w-5" aria-hidden />
      </span>
      <span>{label}</span>
    </div>
  );
}

export default function LandingTokenRow() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
      {TOKENS.map((token) => (
        <TokenBadge key={token.label} {...token} />
      ))}

      <div className="inline-flex h-14 items-center rounded-full border border-dashed border-[var(--color-brand-navy)]/20 bg-white/55 px-5 text-sm font-bold text-[var(--color-text-secondary)] shadow-[0_10px_22px_rgba(24,13,67,0.04)] backdrop-blur-sm">
        + any ERC-20 via Li.Fi
      </div>
    </div>
  );
}
