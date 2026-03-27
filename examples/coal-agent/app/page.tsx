'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, ToolLoadingIndicator } from '@/components/ChatMessage';
import { WalletButton } from '@/components/WalletButton';
import { SUGGESTED_PROMPTS } from '@/lib/types';
import type { ChatMessage as ChatMessageType, StreamEvent } from '@/lib/types';

export default function AgentChat() {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingTool, setPendingTool] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, pendingTool, scrollToBottom]);

  async function sendMessage(content: string) {
    if (!content.trim() || isStreaming) return;

    const userMsg: ChatMessageType = { id: crypto.randomUUID(), role: 'user', content: content.trim() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsStreaming(true);
    setPendingTool(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages
            .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content))
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${error || res.statusText}` },
        ]);
        setIsStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let currentAssistantId: string | null = null;
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          let event: StreamEvent;
          try {
            event = JSON.parse(jsonStr);
          } catch {
            continue;
          }

          switch (event.type) {
            case 'text_delta': {
              setPendingTool(null);
              if (!currentAssistantId) {
                currentAssistantId = crypto.randomUUID();
                setMessages((prev) => [
                  ...prev,
                  { id: currentAssistantId!, role: 'assistant', content: event.content || '' },
                ]);
              } else {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === currentAssistantId ? { ...m, content: m.content + (event.content || '') } : m
                  )
                );
              }
              break;
            }

            case 'tool_start': {
              currentAssistantId = null;
              setPendingTool(event.toolName || null);
              break;
            }

            case 'tool_result': {
              setPendingTool(null);
              setMessages((prev) => [
                ...prev,
                {
                  id: crypto.randomUUID(),
                  role: 'tool',
                  content: '',
                  toolName: event.toolName,
                  toolCallId: event.toolCallId,
                  toolResult: event.toolResult,
                },
              ]);
              break;
            }

            case 'error': {
              setPendingTool(null);
              setMessages((prev) => [
                ...prev,
                { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${event.error}` },
              ]);
              break;
            }

            case 'done': {
              setPendingTool(null);
              break;
            }
          }
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Connection error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        },
      ]);
    } finally {
      setIsStreaming(false);
      setPendingTool(null);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-dvh max-w-3xl mx-auto p-3 sm:p-4 gap-3">
      {/* Header */}
      <header className="flex-none px-5 py-3 border border-black/8 rounded-[28px] flex items-center gap-3 bg-white shadow-sm">
        <div className="text-2xl font-black tracking-tighter text-[var(--brand-navy)]">coal</div>
        <div className="h-5 w-px bg-black/10" />
        <div>
          <h1 className="text-sm font-bold text-[var(--brand-navy)]">Agent</h1>
          <p className="text-[11px] text-[var(--muted)]">AI Commerce on 0G</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] font-semibold px-3 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 hidden sm:inline-block">
            0G Mainnet
          </span>
          <WalletButton />
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 min-h-0">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full gap-8">
            <div className="text-center space-y-3">
              <div className="text-5xl font-black tracking-tighter text-[var(--brand-navy)]">coal</div>
              <p className="text-sm text-[var(--muted)] max-w-md leading-relaxed">
                AI-powered commerce agent. Discover merchants on 0G Storage, query memory,
                create checkouts, verify receipts, and evaluate policies.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg">
              {SUGGESTED_PROMPTS.map((sp) => (
                <button
                  key={sp.label}
                  onClick={() => sendMessage(sp.prompt)}
                  className="text-left px-4 py-3 rounded-2xl border border-black/5 bg-white hover:border-[var(--accent)]/30 hover:shadow-[4px_4px_0px_0px_#FF5C16] transition-all duration-200 group"
                >
                  <span className="font-bold text-sm text-[var(--brand-navy)] block mb-0.5 group-hover:text-[var(--accent)]">{sp.label}</span>
                  <span className="text-xs text-[var(--muted)] line-clamp-2">{sp.prompt}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {pendingTool && <ToolLoadingIndicator toolName={pendingTool} />}

        {isStreaming && !pendingTool && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex gap-1.5 px-1">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:300ms]" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-none px-4 py-3 border border-black/8 rounded-[28px] bg-white shadow-sm">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about merchants, payments, policies..."
            rows={1}
            className="flex-1 resize-none bg-transparent border-none px-2 py-1.5 text-sm text-[var(--brand-navy)] placeholder:text-[var(--muted)]/60 focus:outline-none transition-all duration-200"
            style={{ minHeight: '36px', maxHeight: '120px' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 120) + 'px';
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className="btn-pill px-5 py-2.5 bg-black text-white text-sm font-bold shadow-coal-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#FF5C16] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:translate-x-0 disabled:hover:translate-y-0 transition-all duration-200"
          >
            Send
          </button>
        </div>
        <p className="text-[10px] text-[var(--muted)]/60 mt-1.5 text-center">
          Coal Agent uses GPT-4o for reasoning + Coal APIs + 0G network for decentralized commerce
        </p>
      </div>
    </div>
  );
}
