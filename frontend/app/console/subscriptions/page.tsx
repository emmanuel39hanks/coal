'use client';

import { motion } from 'framer-motion';
import useSWR, { mutate } from 'swr';
import { useApi } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/api-errors';
import { getSettlementToken } from '@/lib/chain';
import { Skeleton, StatCardSkeleton } from '@/components/Skeleton';
import Link from 'next/link';

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

const STATUS_META: Record<SubscriptionRow['status'], { label: string; className: string }> = {
  active:       { label: 'Active',        className: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  payment_due:  { label: 'Payment due',   className: 'bg-amber-50 text-amber-700 border-amber-100' },
  past_due:     { label: 'Past due',      className: 'bg-rose-50 text-rose-700 border-rose-100' },
  paused:       { label: 'Paused',        className: 'bg-slate-100 text-slate-600 border-slate-200' },
  canceled:     { label: 'Canceled',      className: 'bg-gray-100 text-gray-500 border-gray-200' },
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function SubscriptionRowSkeleton() {
  return (
    <tr>
      <td className="py-4 pl-6">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-36 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </td>
      <td className="py-4 px-4"><Skeleton className="h-3.5 w-32 rounded-full" /></td>
      <td className="py-4 px-4"><Skeleton className="h-5 w-20 rounded-full" /></td>
      <td className="py-4 px-4"><Skeleton className="h-3.5 w-24 rounded-full" /></td>
      <td className="py-4 px-4"><Skeleton className="h-3.5 w-16 rounded-full" /></td>
      <td className="py-4 px-4 text-center"><Skeleton className="h-3.5 w-8 rounded-full mx-auto" /></td>
      <td className="py-4 pr-6 text-right">
        <div className="flex items-center justify-end gap-2">
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
        </div>
      </td>
    </tr>
  );
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

  const summary = data?.summary ?? { active: 0, actionRequired: 0, paused: 0, canceled: 0, scheduledRevenue: '0.00' };
  const subscriptions = data?.subscriptions ?? [];
  const settlementSymbol = getSettlementToken().symbol;

  const statCards = [
    {
      label: 'Active',
      value: isLoading ? null : summary.active,
      iconBg: 'bg-emerald-50 text-emerald-600',
      icon: '↻',
    },
    {
      label: 'Action Required',
      value: isLoading ? null : summary.actionRequired,
      iconBg: 'bg-amber-50 text-amber-600',
      icon: '!',
    },
    {
      label: 'Paused',
      value: isLoading ? null : summary.paused,
      iconBg: 'bg-slate-100 text-slate-500',
      icon: '‖',
    },
    {
      label: `Scheduled revenue`,
      value: isLoading ? null : `${summary.scheduledRevenue} ${settlementSymbol}`,
      iconBg: 'bg-[var(--color-brand-orange)]/10 text-[var(--color-brand-orange)]',
      icon: '$',
      small: true,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-black tracking-tight text-[var(--color-brand-navy)]">Subscriptions</h1>
        <p className="mt-1 font-medium text-[var(--color-text-secondary)]">
          Recurring billing, saved mandates, and renewal checkout management.
        </p>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          : statCards.map((card) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[32px] border-2 border-black/5 p-6 h-40 flex flex-col justify-between"
              >
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black ${card.iconBg}`}>
                  {card.icon}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">{card.label}</p>
                  <p className={`font-black tracking-tight text-[var(--color-brand-navy)] mt-1 ${card.small ? 'text-2xl' : 'text-4xl'}`}>
                    {card.value ?? '—'}
                  </p>
                </div>
              </motion.div>
            ))}
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-white rounded-[40px] border-2 border-black/5 overflow-hidden"
      >
        {!isLoading && subscriptions.length === 0 ? (
          <div className="py-24 flex flex-col items-center text-center px-8">
            <div className="w-16 h-16 rounded-[20px] bg-[var(--color-bg-base)] flex items-center justify-center text-2xl mb-6 border-2 border-black/5">
              ↻
            </div>
            <h2 className="text-2xl font-black text-[var(--color-brand-navy)] tracking-tight">No subscriptions yet</h2>
            <p className="mt-3 font-medium text-[var(--color-text-secondary)] max-w-sm">
              Create a recurring product and complete the first paid cycle — the subscription will appear here automatically.
            </p>
            <Link
              href="/console/products?new=true"
              className="mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-[var(--color-brand-navy)] px-6 text-sm font-bold text-white transition hover:opacity-90"
            >
              Create recurring product →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-black/5">
                  <th className="py-4 pl-6 text-left text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Product</th>
                  <th className="py-4 px-4 text-left text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Customer</th>
                  <th className="py-4 px-4 text-left text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Cadence</th>
                  <th className="py-4 px-4 text-left text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Next bill</th>
                  <th className="py-4 px-4 text-left text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Last paid</th>
                  <th className="py-4 px-4 text-center text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Cycles</th>
                  <th className="py-4 pr-6 text-right text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => <SubscriptionRowSkeleton key={i} />)
                  : subscriptions.map((sub) => {
                      const statusMeta = STATUS_META[sub.status];
                      return (
                        <tr
                          key={sub.id}
                          className="border-b border-black/4 last:border-0 hover:bg-[var(--color-bg-base)] transition-colors"
                        >
                          {/* Product + status */}
                          <td className="py-4 pl-6">
                            <p className="text-sm font-black text-[var(--color-brand-navy)] leading-none">{sub.product.name}</p>
                            <span className={`mt-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] ${statusMeta.className}`}>
                              {statusMeta.label}
                            </span>
                          </td>

                          {/* Customer */}
                          <td className="py-4 px-4">
                            <p className="text-sm font-medium text-[var(--color-brand-navy)]">
                              {sub.customerEmail || shortAddress(sub.customerAddress)}
                            </p>
                            {sub.customerEmail && (
                              <p className="mt-0.5 text-xs text-gray-400 font-mono">{shortAddress(sub.customerAddress)}</p>
                            )}
                          </td>

                          {/* Cadence + amount */}
                          <td className="py-4 px-4">
                            <span className="inline-flex items-center rounded-full bg-[var(--color-brand-orange)]/8 px-3 py-1 text-xs font-bold text-[var(--color-brand-orange)]">
                              {sub.cadenceLabel}
                            </span>
                            <p className="mt-1.5 text-sm font-black text-[var(--color-brand-navy)]">
                              {sub.amount} <span className="text-xs font-bold text-gray-400">{sub.currency}</span>
                            </p>
                          </td>

                          {/* Next bill */}
                          <td className="py-4 px-4">
                            <p className="text-sm font-medium text-[var(--color-brand-navy)]">{formatDate(sub.nextBillingAt)}</p>
                          </td>

                          {/* Last paid */}
                          <td className="py-4 px-4">
                            <p className="text-sm font-medium text-[var(--color-text-secondary)]">{formatDate(sub.lastPaidAt)}</p>
                          </td>

                          {/* Renewals */}
                          <td className="py-4 px-4 text-center">
                            <p className="text-sm font-black text-[var(--color-brand-navy)]">{sub.renewalCount}</p>
                          </td>

                          {/* Actions */}
                          <td className="py-4 pr-6">
                            <div className="flex items-center justify-end gap-2 flex-wrap">
                              {sub.latestInvoice?.hostedUrl && (
                                <button
                                  onClick={() => copyRenewalLink(sub.latestInvoice?.hostedUrl ?? null)}
                                  className="h-8 rounded-full border border-black/10 bg-white px-3 text-xs font-bold text-[var(--color-brand-navy)] transition hover:border-[var(--color-brand-orange)] hover:text-[var(--color-brand-orange)]"
                                >
                                  Copy link
                                </button>
                              )}

                              {(sub.status === 'active' || sub.status === 'payment_due') && (
                                <button
                                  onClick={() => handleAction(sub.id, 'pause')}
                                  className="h-8 rounded-full border border-black/10 bg-white px-3 text-xs font-bold text-[var(--color-brand-navy)] transition hover:border-black/20"
                                >
                                  Pause
                                </button>
                              )}

                              {sub.status === 'paused' && (
                                <button
                                  onClick={() => handleAction(sub.id, 'resume')}
                                  className="h-8 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:border-emerald-300"
                                >
                                  Resume
                                </button>
                              )}

                              {sub.status !== 'canceled' && (
                                <button
                                  onClick={() => handleAction(sub.id, 'cancel')}
                                  className="h-8 rounded-full border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-600 transition hover:border-rose-300"
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
