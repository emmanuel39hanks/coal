'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ToolResultCard } from './ToolResultCard';
import type { ChatMessage as ChatMessageType } from '@/lib/types';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-black text-white text-sm shadow-coal-sm">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === 'tool' && message.toolResult) {
    return (
      <div className="max-w-[90%]">
        <ToolResultCard toolName={message.toolName || 'unknown'} data={message.toolResult} />
      </div>
    );
  }

  // Assistant message
  if (!message.content) return null;

  return (
    <div className="max-w-[85%]">
      <div className="prose prose-sm max-w-none text-sm leading-relaxed text-[var(--brand-navy)] [&_p]:mb-2 [&_ul]:mb-2 [&_ol]:mb-2 [&_li]:mb-0.5 [&_code]:text-[var(--accent)] [&_code]:bg-[var(--accent)]/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-[var(--brand-navy)] [&_pre]:text-white [&_pre]:rounded-2xl [&_pre]:p-3 [&_strong]:text-[var(--brand-navy)] [&_strong]:font-bold [&_a]:text-[var(--accent)] [&_a]:font-semibold [&_h1]:text-[var(--brand-navy)] [&_h2]:text-[var(--brand-navy)] [&_h3]:text-[var(--brand-navy)] [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_table]:rounded-xl [&_table]:overflow-hidden [&_table]:border [&_table]:border-black/5 [&_thead]:bg-[var(--background)] [&_th]:text-left [&_th]:font-bold [&_th]:text-[var(--brand-navy)] [&_th]:px-3 [&_th]:py-2 [&_th]:border-b [&_th]:border-black/5 [&_td]:px-3 [&_td]:py-2 [&_td]:border-b [&_td]:border-black/5 [&_tr:last-child_td]:border-b-0 [&_tr:hover]:bg-black/[0.015]">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
      </div>
    </div>
  );
}

export function ToolLoadingIndicator({ toolName }: { toolName: string }) {
  const labels: Record<string, string> = {
    discover_merchant_on_0g: 'Downloading from 0G Storage...',
    get_merchant_profile: 'Fetching merchant profile...',
    query_merchant_memory: 'Querying merchant memory via 0G Compute...',
    route_commerce_request: 'Routing commerce request...',
    get_recommendations: 'Getting recommendations...',
    evaluate_policy: 'Evaluating policy via Sealed Inference...',
    check_paywall: 'Checking paywall access...',
    create_checkout: 'Creating checkout session...',
    create_paywall_pay_intent: 'Creating payment intent...',
    verify_receipt: 'Verifying receipt proof trail...',
  };

  return (
    <div className="max-w-[90%]">
      <div className="border border-black/5 rounded-2xl bg-white px-4 py-3 flex items-center gap-3 shadow-sm">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:300ms]" />
        </div>
        <span className="text-xs text-[var(--muted)] font-medium">{labels[toolName] || `Running ${toolName}...`}</span>
      </div>
    </div>
  );
}
