'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { isSafeUrl, isSafeImageUrl } from '@/lib/types';

type PayStatus = 'idle' | 'waiting' | 'confirmed' | 'expired' | 'failed';

export function CheckoutCard({ data }: { data: Record<string, unknown> }) {
  const [payStatus, setPayStatus] = useState<PayStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const pollingRef = useRef(false);
  const paymentUrl = isSafeUrl(data.paymentUrl) ? data.paymentUrl : undefined;
  const checkoutId = data.checkoutId as string | undefined;
  const productImage = isSafeImageUrl(data.productImage) ? data.productImage : undefined;

  // Extract session ID from payment URL
  const sessionId = paymentUrl?.split('/').pop() || null;

  const pollStatus = useCallback(async () => {
    if (!sessionId || pollingRef.current) return;
    pollingRef.current = true;
    try {
      const res = await fetch(`/api/pay/status?sessionId=${sessionId}`);
      const result = await res.json();
      if (result.status === 'confirmed') {
        setPayStatus('confirmed');
        setTxHash(result.txHash || null);
      } else if (result.status === 'expired') {
        setPayStatus('expired');
      } else if (result.status === 'failed') {
        setPayStatus('failed');
      }
    } catch {
      // ignore polling errors
    } finally {
      pollingRef.current = false;
    }
  }, [sessionId]);

  useEffect(() => {
    if (payStatus !== 'waiting') return;
    const interval = setInterval(pollStatus, 3000);
    const timeout = setTimeout(() => {
      setPayStatus((s) => (s === 'waiting' ? 'expired' : s));
    }, 5 * 60 * 1000); // 5 min timeout
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [payStatus, pollStatus]);

  function handlePay() {
    if (!paymentUrl) return;
    window.open(paymentUrl, '_blank', 'noopener,noreferrer');
    setPayStatus('waiting');
  }

  return (
    <div className="border border-black/5 rounded-2xl bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
        <span className="text-sm font-bold text-[var(--brand-navy)]">Checkout</span>
        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${
          payStatus === 'confirmed'
            ? 'bg-green-50 text-green-700 border-green-200'
            : payStatus === 'waiting'
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] border-[var(--brand-blue)]/20'
        }`}>
          {payStatus === 'confirmed' ? 'Paid' : payStatus === 'waiting' ? 'Awaiting payment...' : (data.status as string) || 'pending'}
        </span>
      </div>

      <div className="px-4 py-3 text-xs space-y-2">
        {/* Product display with image */}
        <div className="flex items-center gap-3">
          {productImage ? (
            <img src={productImage} alt={data.productName as string || 'Product'} className="w-14 h-14 rounded-xl object-cover flex-none shadow-sm" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-[var(--background)] flex items-center justify-center flex-none">
              <span className="text-2xl">&#x1f6d2;</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-xl font-black text-[var(--brand-navy)]">{data.amount as string} {data.currency as string}</div>
            {!!data.productName && <div className="font-semibold text-[var(--brand-navy)]">{data.productName as string}</div>}
            {!!data.description && <div className="text-[var(--muted)]">{data.description as string}</div>}
          </div>
        </div>

        <div className="font-mono text-[10px] text-[var(--muted)]">ID: {checkoutId}</div>

        {/* Payment CTA */}
        {payStatus === 'idle' && paymentUrl && (
          <button
            onClick={handlePay}
            className="w-full mt-2 text-center px-4 py-3 rounded-full bg-black text-white text-sm font-bold shadow-coal hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-[3px_3px_0px_0px_#FF5C16] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none transition-all duration-200"
          >
            Pay {data.amount as string} {data.currency as string} &rarr;
          </button>
        )}

        {/* Waiting for payment */}
        {payStatus === 'waiting' && (
          <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-sm font-bold text-amber-700">Waiting for payment...</span>
            </div>
            <p className="text-[11px] text-amber-600">Complete the payment in the tab that opened. This card will update automatically.</p>
          </div>
        )}

        {/* Payment confirmed */}
        {payStatus === 'confirmed' && (
          <div className="mt-2 p-3 rounded-xl bg-green-50 border border-green-200">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-[10px] font-bold">&#10003;</span>
              <span className="text-sm font-bold text-green-700">Payment confirmed!</span>
            </div>
            {txHash && <div className="font-mono text-[10px] text-green-600 truncate">Tx: {txHash}</div>}
            <p className="text-[11px] text-green-600 mt-1">Ask the agent to verify your receipt and show the 0G proof trail.</p>
          </div>
        )}

        {/* Expired */}
        {payStatus === 'expired' && (
          <div className="mt-2 p-3 rounded-xl bg-red-50 border border-red-200 text-center">
            <span className="text-sm font-bold text-red-700">Payment session expired</span>
          </div>
        )}

        {!!data.expiresAt && payStatus === 'idle' && (
          <div className="text-[10px] text-[var(--muted)]">Expires: {data.expiresAt as string}</div>
        )}
      </div>
    </div>
  );
}
