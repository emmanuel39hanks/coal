'use client';

import { motion } from 'framer-motion';
import useSWR, { mutate } from 'swr';
import { useApi } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/api-errors';
import { getSettlementToken } from '@/lib/chain';

type SubscriptionRow = {
  id: string;
  status: 'active' | 'payment_due' | 'past_due' | 'paused' | 'canceled';
  amount: string;
  currency: string;
  customerAddress: string;
  customerEmail: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextBillingAt: string;
  lastPaidAt: string | null;
  renewalCount: number;
  cadenceLabel: string;
  product: { id: string; name: string };
  mandate: { id: string; status: string; acceptedAt: string };
  latestInvoice: {
    id: string;
    status: string;
    hostedUrl: string | null;
    dueAt: string;
    paidAt: string | null;
    sequenceNumber: number;
    amount: string;
    currency: string;
  } | null;
};

type SubscriptionPayload = {
  summary: {
    active: number;
    actionRequired: number;
    paused: number;
    canceled: number;
    scheduledRevenue: string;
  };
  subscriptions: SubscriptionRow[];
};

const STATUS_STYLES: Record<SubscriptionRow['status'], string> = {
  active: 'bg-emerald-50 text-emerald-700',
  payment_due: 'bg-amber-50 text-amber-700',
  past_due: 'bg-rose-50 text-rose-700',
  paused: 'bg-slate-100 text-slate-700',
  canceled: 'bg-gray-100 text-gray-600',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function SubscriptionsPage() {
  const { fetcher, request } = useApi();
  const toast = useToast();
  const { data, isLoading } = useSWR<SubscriptionPayload>('/api/console/subscriptions', fetcher);

  const handleAction = async (id: string, action: 'pause' | 'resume' | 'cancel') => {
    try {
      await request(`/api/console/subscriptions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      });
      await mutate('/api/console/subscriptions');
      toast('success', `Subscription ${action}d`);
    } catch (error) {
      toast('error', getErrorMessage(error, `Failed to ${action} subscription`));
    }
  };

  const copyRenewalLink = async (url: string | null) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast('success', 'Renewal checkout link copied');
    } catch (error) {
      toast('error', getErrorMessage(error, 'Failed to copy renewal link'));
    }
  };

  const summary = data?.summary ?? {
    active: 0,
    actionRequired: 0,
    paused: 0,
    canceled: 0,
    scheduledRevenue: '0.00',
  };
  const subscriptions = data?.subscriptions ?? [];
  const settlementSymbol = getSettlementToken().symbol;

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"
      >
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[var(--color-brand-navy)]">Subscriptions</h1>
          <p className="font-medium text-[var(--color-text-secondary)]">
            Recurring billing, saved mandates, and renewal checkout management for wallet-native customers.
          </p>
        </div>
        <div className="rounded-full border border-black/5 bg-white px-5 py-3 text-sm font-bold text-[var(--color-brand-navy)] shadow-sm">
          Scheduled revenue: {summary.scheduledRevenue} {settlementSymbol}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {[
          { label: 'Active', value: summary.active, tone: 'bg-emerald-50 text-emerald-700' },
          { label: 'Action Required', value: summary.actionRequired, tone: 'bg-amber-50 text-amber-700' },
          { label: 'Paused', value: summary.paused, tone: 'bg-slate-100 text-slate-700' },
          { label: 'Canceled', value: summary.canceled, tone: 'bg-gray-100 text-gray-600' },
        ].map((card) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] border-2 border-black/5 bg-white p-6"
          >
            <div className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${card.tone}`}>{card.label}</div>
            <div className="mt-5 text-4xl font-black tracking-tight text-[var(--color-brand-navy)]">{card.value}</div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-[40px] border-2 border-black/5 bg-white p-4 md:p-6"
      >
        {isLoading ? (
          <div className="py-20 text-center font-medium text-[var(--color-text-secondary)]">Loading subscriptions…</div>
        ) : subscriptions.length === 0 ? (
          <div className="py-20 text-center">
            <h2 className="text-2xl font-black text-[var(--color-brand-navy)]">No subscriptions yet</h2>
            <p className="mt-3 font-medium text-[var(--color-text-secondary)]">
              Convert a product to recurring billing, then complete the first paid cycle to create the subscription.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {subscriptions.map((subscription) => (
              <div
                key={subscription.id}
                className="rounded-[32px] border border-black/5 bg-[var(--color-bg-base)]/60 p-5 md:p-6"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-black text-[var(--color-brand-navy)]">{subscription.product.name}</h2>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[subscription.status]}`}>
                        {subscription.status.replace('_', ' ')}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[var(--color-brand-orange)]">
                        {subscription.cadenceLabel}
                      </span>
                    </div>
                    <div className="grid gap-3 text-sm font-medium text-[var(--color-text-secondary)] md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Subscriber</div>
                        <div className="mt-1 text-[var(--color-brand-navy)]">
                          {subscription.customerEmail || shortAddress(subscription.customerAddress)}
                        </div>
                        {subscription.customerEmail && (
                          <div className="mt-1 text-xs text-gray-400">{shortAddress(subscription.customerAddress)}</div>
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Next bill</div>
                        <div className="mt-1 text-[var(--color-brand-navy)]">{formatDate(subscription.nextBillingAt)}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Current period ends</div>
                        <div className="mt-1 text-[var(--color-brand-navy)]">{formatDate(subscription.currentPeriodEnd)}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Mandate</div>
                        <div className="mt-1 text-[var(--color-brand-navy)]">
                          {subscription.mandate.status} since {formatDate(subscription.mandate.acceptedAt)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-black/5 bg-white p-4 text-sm font-medium text-[var(--color-text-secondary)] lg:min-w-[280px]">
                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Latest invoice</div>
                    {subscription.latestInvoice ? (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <span>Cycle #{subscription.latestInvoice.sequenceNumber}</span>
                          <span className="font-bold text-[var(--color-brand-navy)]">
                            {subscription.latestInvoice.amount} {subscription.latestInvoice.currency}
                          </span>
                        </div>
                        <div>Status: <span className="font-bold text-[var(--color-brand-navy)]">{subscription.latestInvoice.status}</span></div>
                        <div>Due: <span className="font-bold text-[var(--color-brand-navy)]">{formatDate(subscription.latestInvoice.dueAt)}</span></div>
                        {subscription.latestInvoice.hostedUrl && (
                          <button
                            onClick={() => copyRenewalLink(subscription.latestInvoice?.hostedUrl || null)}
                            className="mt-2 inline-flex rounded-full border border-black/10 bg-[var(--color-bg-base)] px-4 py-2 text-xs font-bold text-[var(--color-brand-navy)] transition hover:border-[var(--color-brand-orange)] hover:text-[var(--color-brand-orange)]"
                          >
                            Copy renewal checkout
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 text-[var(--color-text-secondary)]">No invoice issued yet.</div>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  {subscription.status === 'active' || subscription.status === 'payment_due' ? (
                    <button
                      onClick={() => handleAction(subscription.id, 'pause')}
                      className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-bold text-[var(--color-brand-navy)] transition hover:border-black/20"
                    >
                      Pause
                    </button>
                  ) : null}

                  {subscription.status === 'paused' ? (
                    <button
                      onClick={() => handleAction(subscription.id, 'resume')}
                      className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-bold text-[var(--color-brand-navy)] transition hover:border-[var(--color-brand-orange)] hover:text-[var(--color-brand-orange)]"
                    >
                      Resume
                    </button>
                  ) : null}

                  {subscription.status !== 'canceled' ? (
                    <button
                      onClick={() => handleAction(subscription.id, 'cancel')}
                      className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-600 transition hover:border-rose-300"
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
