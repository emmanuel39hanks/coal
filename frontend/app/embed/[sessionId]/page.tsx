'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import PaymentView from '@/components/PaymentView';
import { getApiBaseUrl } from '@/lib/api-base';

interface EmbedSessionData {
  expired?: boolean;
  id?: string;
  amount?: string;
  currency?: string;
  description?: string | null;
  status?: string;
  expiresAt?: string;
  merchant?: {
    name: string | null;
    image: string | null;
    payoutAddress: string | null;
  };
  product?: {
    name: string;
    price: string;
    image: string | null;
    description: string | null;
  } | null;
  redirectUrl?: string | null;
}

function postEmbedEvent(type: string, payload: Record<string, unknown> = {}) {
  if (typeof window === 'undefined' || window.parent === window) {
    return;
  }

  // Use referrer origin if available, otherwise restrict to same origin
  const targetOrigin = document.referrer
    ? new URL(document.referrer).origin
    : window.location.origin;
  window.parent.postMessage({ type, ...payload }, targetOrigin);
}

export default function EmbedPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const apiBaseUrl = getApiBaseUrl();

  const [session, setSession] = useState<EmbedSessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    fetch(`${apiBaseUrl}/api/resolve/session?id=${sessionId}`, { cache: 'no-store' })
      .then(async (res) => {
        if (cancelled) return;

        if (res.status === 410) {
          setSession({ expired: true, id: sessionId });
          return;
        }

        if (!res.ok) {
          throw new Error('Payment session not found.');
        }

        const data = await res.json();
        if (!cancelled) {
          setSession(data);
        }
      })
      .catch((fetchError) => {
        if (cancelled) return;
        const message =
          fetchError instanceof Error && fetchError.message
            ? fetchError.message
            : 'Failed to load payment session.';
        setError(message);
        postEmbedEvent('coal:error', { sessionId, message });
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center px-6 text-sm font-semibold text-slate-500">
        Loading secure checkout...
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-[28px] bg-white p-8 text-center shadow-[0_18px_50px_rgba(15,23,42,0.08)] border border-black/5">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl">
            !
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--color-brand-navy)] mb-3">
            Checkout unavailable
          </h1>
          <p className="text-sm font-medium text-slate-500">
            {error || 'We could not load this checkout session.'}
          </p>
        </div>
      </div>
    );
  }

  return <PaymentView data={session} type="session" mode="embed" />;
}
