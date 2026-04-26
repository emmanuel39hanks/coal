'use client';

/**
 * Settlement chain selector for the checkout UI.
 * Lets the payer pick Base or World Chain.
 *
 * World Chain is flagged as "Free gas for verified humans" — verified
 * users save gas when paying there. Inside the Mini App, default this
 * to 'worldchain' so the payer doesn't have to pick.
 */

export type ChainKey = 'base' | 'worldchain';

interface ChainOption {
    key: ChainKey;
    label: string;
    sub: string;
    badge?: string;
}

const OPTIONS: ChainOption[] = [
    { key: 'base', label: 'Base', sub: 'USDC on Coinbase L2' },
    { key: 'worldchain', label: 'World Chain', sub: 'USDC on OP Stack', badge: 'Free gas for verified humans' },
];

interface ChainSelectorProps {
    value: ChainKey;
    onChange: (key: ChainKey) => void;
    disabled?: boolean;
    /** If true, hide the component (used when only one option is available). */
    hidden?: boolean;
}

export function ChainSelector({ value, onChange, disabled, hidden }: ChainSelectorProps) {
    if (hidden) return null;

    return (
        <div className="w-full" role="radiogroup" aria-label="Settlement chain">
            <div className="text-[10px] font-black text-[var(--color-brand-navy)] mb-2 uppercase tracking-[0.2em]">
                Settlement Chain
            </div>
            <div className="grid grid-cols-2 gap-2">
                {OPTIONS.map((opt) => {
                    const active = value === opt.key;
                    return (
                        <button
                            key={opt.key}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            disabled={disabled}
                            onClick={() => onChange(opt.key)}
                            className={[
                                'relative rounded-2xl border-2 px-4 py-3 text-left transition-all',
                                active
                                    ? 'border-[var(--color-brand-navy)] bg-[var(--color-brand-navy)]/5'
                                    : 'border-black/10 hover:border-black/25',
                                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                            ].join(' ')}
                        >
                            <div className="flex items-center gap-2">
                                <div className={[
                                    'h-3.5 w-3.5 rounded-full border-2 shrink-0 transition-colors',
                                    active
                                        ? 'border-[var(--color-brand-navy)] bg-[var(--color-brand-navy)]'
                                        : 'border-gray-300',
                                ].join(' ')}>
                                    {active && (
                                        <div className="m-[3px] h-1.5 w-1.5 rounded-full bg-white" />
                                    )}
                                </div>
                                <span className="text-[13px] font-black text-[var(--color-brand-navy)]">
                                    {opt.label}
                                </span>
                            </div>
                            <div className="mt-1.5 text-[10px] text-gray-500 font-medium">
                                {opt.sub}
                            </div>
                            {opt.badge && (
                                <div className="mt-1 text-[9px] font-bold text-green-600">
                                    {opt.badge}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
