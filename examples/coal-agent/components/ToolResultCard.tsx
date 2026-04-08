'use client';

import { Component, type ReactNode } from 'react';
import { ZeroGDownloadCard } from './cards/ZeroGDownloadCard';
import { MerchantProfileCard } from './cards/MerchantProfileCard';
import { ReceiptCard } from './cards/ReceiptCard';
import { MemoryQueryCard } from './cards/MemoryQueryCard';
import { CommerceRouteCard } from './cards/CommerceRouteCard';
import { PolicyEvalCard } from './cards/PolicyEvalCard';
import { CheckoutCard } from './cards/CheckoutCard';
import { PaywallCard } from './cards/PaywallCard';
import { AgentPaymentCard } from './cards/AgentPaymentCard';

class CardErrorBoundary extends Component<{ toolName: string; children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="border border-red-200 rounded-2xl bg-red-50 px-4 py-3">
          <div className="text-sm font-bold text-red-700">Render Error</div>
          <div className="text-xs text-red-600 mt-1">{this.props.toolName}: {this.state.error.message}</div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface ToolResultCardProps {
  toolName: string;
  data: Record<string, unknown>;
}

export function ToolResultCard({ toolName, data }: ToolResultCardProps) {
  if (data.error) {
    return (
      <div className="border border-red-200 rounded-2xl bg-red-50 overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between border-b border-red-100">
          <span className="text-sm font-bold text-red-700">Tool Error</span>
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-red-100 text-red-600 font-mono font-semibold">{toolName}</span>
        </div>
        <div className="px-4 py-3 text-xs text-red-600">{data.error as string}</div>
      </div>
    );
  }

  let card: ReactNode;
  switch (toolName) {
    case 'discover_merchant_on_0g':
      card = <ZeroGDownloadCard data={data} />; break;
    case 'get_merchant_profile':
      card = <MerchantProfileCard data={data} />; break;
    case 'verify_receipt':
      card = <ReceiptCard data={data} />; break;
    case 'query_merchant_memory':
      card = <MemoryQueryCard data={data} />; break;
    case 'route_commerce_request':
      card = <CommerceRouteCard data={data} />; break;
    case 'evaluate_policy':
      card = <PolicyEvalCard data={data} />; break;
    case 'create_checkout':
      card = <CheckoutCard data={data} />; break;
    case 'check_paywall':
    case 'create_paywall_pay_intent':
      card = <PaywallCard data={data} />; break;
    case 'get_recommendations':
      card = <CommerceRouteCard data={data} />; break;
    case 'discover_merchants': {
      const merchants = (data.merchants || []) as Array<Record<string, unknown>>;
      const stats = data.stats as Record<string, unknown> | undefined;
      card = (
        <div className="border border-black/5 rounded-2xl bg-white overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
            <span className="text-sm font-bold text-[var(--brand-navy)]">Marketplace Discovery</span>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-semibold">
              {String(stats?.totalMerchants || 0)} merchants · {String(stats?.totalProducts || 0)} products
            </span>
          </div>
          <div className="px-4 py-3 space-y-3">
            {merchants.map((m: Record<string, unknown>) => {
              const products = (m.topProducts || []) as Array<Record<string, unknown>>;
              const paywalls = (m.topPaywalls || []) as Array<Record<string, unknown>>;
              return (
                <div key={String(m.id)} className="p-3 rounded-xl bg-[var(--background)] border border-black/3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold text-[var(--brand-navy)]">{String(m.name || 'Merchant')}</span>
                    {Boolean((m.zeroG as Record<string, unknown>)?.published) && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 font-semibold">0G</span>
                    )}
                  </div>
                  {products.length > 0 && (
                    <div className="space-y-1 mb-2">
                      <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Products</span>
                      {products.map((p: Record<string, unknown>) => (
                        <div key={String(p.id)} className="flex justify-between text-xs">
                          <span className="text-[var(--brand-navy)] font-medium">{String(p.name)}</span>
                          <span className="font-bold text-[var(--brand-navy)]">${String(p.price)} USDC</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {paywalls.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider">Paywalls</span>
                      {paywalls.map((pw: Record<string, unknown>) => (
                        <div key={String(pw.id)} className="flex justify-between text-xs">
                          <span className="text-[var(--brand-navy)] font-medium">{String(pw.name)}</span>
                          <span className="font-bold text-[var(--brand-navy)]">${String(pw.price)} {String(pw.pricingModel) === 'per_call' ? '/call' : ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
      break;
    }
    case 'execute_payment':
      card = <AgentPaymentCard data={data} />; break;
    case 'get_agent_wallet':
      card = (
        <div className="border border-black/5 rounded-2xl bg-white overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
            <span className="text-sm font-bold text-[var(--brand-navy)]">Agent Wallet</span>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-semibold">Base</span>
          </div>
          <div className="px-4 py-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-[var(--muted)]">Address</span><span className="font-mono text-[var(--brand-navy)] font-medium">{String(data.address || '').slice(0, 6)}...{String(data.address || '').slice(-4)}</span></div>
            <div className="flex justify-between"><span className="text-[var(--muted)]">Balance</span><span className="text-lg font-black text-[var(--brand-navy)]">${parseFloat(String(data.balance || '0')).toFixed(2)} USDC</span></div>
          </div>
        </div>
      ); break;
    default:
      card = (
        <div className="border border-black/5 rounded-2xl bg-white overflow-hidden shadow-sm">
          <div className="px-4 py-3 flex items-center justify-between border-b border-black/5">
            <span className="text-sm font-bold text-[var(--brand-navy)]">Tool Result</span>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-black/5 text-[var(--muted)] font-mono font-semibold">{toolName}</span>
          </div>
          <pre className="px-4 py-3 text-[10px] font-mono overflow-x-auto max-h-40 overflow-y-auto text-[var(--muted)]">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      );
  }

  return <CardErrorBoundary toolName={toolName}>{card}</CardErrorBoundary>;
}
