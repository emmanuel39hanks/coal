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
      // Flatten all products with images for a visual marketplace
      const allProducts: Array<Record<string, unknown> & { merchantName: string }> = [];
      const allPaywalls: Array<Record<string, unknown> & { merchantName: string }> = [];
      for (const m of merchants) {
        const mName = String(m.name || 'Merchant');
        for (const p of ((m.topProducts || []) as Array<Record<string, unknown>>)) {
          allProducts.push({ ...p, merchantName: mName });
        }
        for (const pw of ((m.topPaywalls || []) as Array<Record<string, unknown>>)) {
          allPaywalls.push({ ...pw, merchantName: mName });
        }
      }
      card = (
        <div className="border border-black/5 rounded-2xl bg-white overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
            <span className="text-sm font-bold text-[var(--brand-navy)]">Marketplace</span>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-semibold">
              {String(stats?.totalMerchants || 0)} merchants · {allProducts.length} products
            </span>
          </div>
          {/* Product grid with images */}
          {allProducts.length > 0 && (
            <div className="p-3 grid grid-cols-2 gap-2">
              {allProducts.map((p) => {
                const imgUrl = p.image as string | undefined;
                return (
                  <div key={String(p.id)} className="rounded-xl border border-black/5 overflow-hidden bg-[var(--background)]">
                    {imgUrl && (
                      <div className="aspect-square bg-white">
                        <img src={imgUrl} alt={String(p.name)} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-2.5">
                      <div className="text-[11px] font-bold text-[var(--brand-navy)] truncate">{String(p.name)}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-black text-[var(--accent)]">${String(p.price)}</span>
                        <span className="text-[9px] text-[var(--muted)] font-medium">{p.merchantName}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* Paywalls */}
          {allPaywalls.length > 0 && (
            <div className="px-3 pb-3 space-y-1.5">
              <div className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider px-1">Agent-Payable Gates</div>
              {allPaywalls.map((pw) => (
                <div key={String(pw.id)} className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--background)] border border-black/3">
                  <div>
                    <div className="text-[11px] font-bold text-[var(--brand-navy)]">{String(pw.name)}</div>
                    <div className="text-[9px] text-[var(--muted)]">{pw.merchantName} · {String(pw.pricingModel) === 'per_call' ? 'per call' : 'one-time'}</div>
                  </div>
                  <span className="text-xs font-black text-[var(--accent)]">${String(pw.price)}</span>
                </div>
              ))}
            </div>
          )}
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
