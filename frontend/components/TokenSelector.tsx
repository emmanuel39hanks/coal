'use client';

import { useState, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { TOKEN_OPTIONS, USDC_BASE, type TokenOption } from '@/lib/lifi';
import Modal from '@/components/Modal';

interface TokenSelectorProps {
  selected: TokenOption;
  onChange: (token: TokenOption) => void;
  quote: { fromAmount: string; estimatedTime: number; fees: string } | null;
  loading: boolean;
  toAmountUSDC: number;
  quoteUnavailableReason?: string | null;
}

function formatFromAmount(amount: string, decimals: number, symbol: string): string {
  const value = Number(BigInt(amount)) / 10 ** decimals;
  const formatted = value < 0.001 ? value.toExponential(3) : value.toPrecision(4).replace(/\.?0+$/, '');
  return `${formatted} ${symbol}`;
}

function isUsdcOnBase(token: TokenOption): boolean {
  return (
    token.address.toLowerCase() === USDC_BASE.address.toLowerCase() &&
    token.chainId === USDC_BASE.chainId
  );
}

function chainLabel(chainId: number) {
  if (chainId === 8453) return 'Base';
  if (chainId === 84532) return 'Base Sepolia';
  if (chainId === 1) return 'Ethereum';
  if (chainId === 42161) return 'Arbitrum';
  return `Chain ${chainId}`;
}

function chainAccentClass(chainId: number) {
  if (chainId === 8453 || chainId === 84532) return 'bg-[#E8F0FF] text-[#2456E8]';
  if (chainId === 1) return 'bg-[#EEF2FF] text-[#4B61D1]';
  if (chainId === 42161) return 'bg-[#EAF9FF] text-[#1B6FA8]';
  return 'bg-gray-100 text-gray-500';
}

function tokenKey(t: TokenOption) {
  return `${t.chainId}-${t.address.toLowerCase()}`;
}

function isTokenSelected(token: TokenOption, selected: TokenOption) {
  return (
    token.address.toLowerCase() === selected.address.toLowerCase() &&
    token.chainId === selected.chainId
  );
}

// How many to show in the inline dropdown before "See more"
const INLINE_LIMIT = 5;

export default function TokenSelector({
  selected,
  onChange,
  quote,
  loading,
  toAmountUSDC,
  quoteUnavailableReason,
}: TokenSelectorProps) {
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hasMultipleOptions = TOKEN_OPTIONS.length > 1;

  const inlineTokens = TOKEN_OPTIONS.slice(0, INLINE_LIMIT);
  const hasMore = TOKEN_OPTIONS.length > INLINE_LIMIT;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handlePick(token: TokenOption) {
    onChange(token);
    setOpen(false);
    setModalOpen(false);
  }

  const direct = isUsdcOnBase(selected);

  return (
    <>
      <div ref={ref} className="relative mb-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Pay with</p>

        {/* Trigger button */}
        <button
          type="button"
          onClick={() => { if (hasMultipleOptions) setOpen((o) => !o); }}
          className={`w-full rounded-[28px] border border-black/8 bg-white px-4 py-3 shadow-[0_14px_30px_rgba(24,13,67,0.06)] transition-all focus:outline-none focus:border-[var(--color-brand-orange)] ${
            hasMultipleOptions
              ? 'hover:border-black/12 hover:shadow-[0_18px_40px_rgba(24,13,67,0.08)]'
              : 'cursor-default'
          }`}
        >
          <span className="flex min-w-0 items-center gap-3 font-bold text-[var(--color-brand-navy)]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-bg-base)] ring-1 ring-black/5">
              <Icon icon={selected.icon} className="h-6 w-6" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-sm font-black leading-none">{selected.symbol}</span>
              <span className="mt-1 block truncate text-xs font-medium text-gray-400">{selected.name}</span>
            </span>
            <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${chainAccentClass(selected.chainId)}`}>
              {chainLabel(selected.chainId)}
            </span>
            <Icon
              icon="lucide:chevron-right"
              className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}
              aria-hidden
            />
          </span>
        </button>

        {/* Inline dropdown */}
        {open && (
          <div
            className="absolute z-50 mt-2 rounded-[28px] border border-black/8 bg-white shadow-[0_24px_56px_rgba(24,13,67,0.14)] overflow-hidden"
            style={{ width: ref.current?.offsetWidth }}
          >
            {/* Scrollable list */}
            <div className="max-h-[280px] overflow-y-auto">
              {inlineTokens.map((token) => (
                <TokenRow
                  key={tokenKey(token)}
                  token={token}
                  isSelected={isTokenSelected(token, selected)}
                  onPick={handlePick}
                />
              ))}
            </div>

            {/* See more footer */}
            {hasMore && (
              <div className="border-t border-black/5">
                <button
                  type="button"
                  onClick={() => { setOpen(false); setModalOpen(true); }}
                  className="w-full px-4 py-3 text-left text-sm font-bold text-[var(--color-brand-orange)] hover:bg-[var(--color-bg-base)] transition-colors flex items-center justify-between"
                >
                  See more tokens
                  <Icon icon="lucide:chevron-right" className="h-4 w-4" aria-hidden />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Quote / status line */}
        <div className="mt-2 min-h-[20px]">
          {direct ? (
            <p className="text-xs font-semibold text-green-600">
              Direct settlement path on {chainLabel(selected.chainId)}
            </p>
          ) : loading ? (
            <p className="animate-pulse text-xs font-medium text-gray-400">Getting route quote…</p>
          ) : quote ? (
            <p className="text-xs font-medium text-gray-500">
              ≈ {formatFromAmount(quote.fromAmount, selected.decimals, selected.symbol)}
              {' '}+{' '}
              <span className="text-gray-400">${quote.fees} estimated fees</span>
            </p>
          ) : quoteUnavailableReason ? (
            <p className="text-xs font-medium text-gray-400">{quoteUnavailableReason}</p>
          ) : (
            <p className="text-xs font-medium text-amber-500">Quote unavailable for this route. Try another asset.</p>
          )}
        </div>
      </div>

      {/* All-tokens modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Choose token" maxWidth="max-w-sm">
        <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
          {TOKEN_OPTIONS.map((token) => (
            <TokenRow
              key={tokenKey(token)}
              token={token}
              isSelected={isTokenSelected(token, selected)}
              onPick={handlePick}
              rounded
            />
          ))}
        </div>
      </Modal>
    </>
  );
}

/* ─── Shared token row ──────────────────────────────────────────────────────── */

function TokenRow({
  token,
  isSelected,
  onPick,
  rounded = false,
}: {
  token: TokenOption;
  isSelected: boolean;
  onPick: (t: TokenOption) => void;
  rounded?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(token)}
      className={`w-full px-4 py-3 text-left transition-colors hover:bg-[var(--color-bg-base)] ${
        isSelected ? 'bg-[var(--color-bg-base)]' : ''
      } ${rounded ? 'rounded-2xl' : ''}`}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-bg-base)] ring-1 ring-black/5">
          <Icon icon={token.icon} className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black leading-none text-[var(--color-brand-navy)]">{token.symbol}</p>
          <p className="mt-0.5 truncate text-xs text-gray-400">{token.name}</p>
        </div>
        <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${chainAccentClass(token.chainId)}`}>
          {chainLabel(token.chainId)}
        </span>
        {/* Checkmark — inline, same row, right-aligned after chain badge */}
        {isSelected && (
          <svg className="h-4 w-4 shrink-0 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    </button>
  );
}
