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
