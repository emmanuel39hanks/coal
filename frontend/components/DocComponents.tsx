'use client';

import React, { useState, useRef } from 'react';
import { InfoCircle, Warning2, CloseCircle, TickCircle, Copy, TickSquare, ArrowRight } from 'iconsax-reactjs';
import Link from 'next/link';

// ─── Callout ─────────────────────────────────────────────────────────────────

type CalloutVariant = 'info' | 'warning' | 'danger' | 'tip';

const CALLOUT_STYLES: Record<
    CalloutVariant,
    { border: string; bg: string; iconColor: string; labelColor: string; label: string; icon: React.ReactNode }
> = {
    info: {
        border: 'border-blue-200',
        bg: 'bg-blue-50/80',
        iconColor: 'text-blue-500',
        labelColor: 'text-blue-800',
        label: 'Note',
        icon: <InfoCircle size={16} variant="Bold" />,
    },
    warning: {
        border: 'border-amber-200',
        bg: 'bg-amber-50/80',
        iconColor: 'text-amber-500',
        labelColor: 'text-amber-900',
        label: 'Warning',
        icon: <Warning2 size={16} variant="Bold" />,
    },
    danger: {
        border: 'border-red-200',
        bg: 'bg-red-50/80',
        iconColor: 'text-red-500',
        labelColor: 'text-red-900',
        label: 'Danger',
        icon: <CloseCircle size={16} variant="Bold" />,
    },
    tip: {
        border: 'border-orange-200',
        bg: 'bg-orange-50/80',
        iconColor: 'text-[var(--color-brand-orange)]',
        labelColor: 'text-orange-900',
        label: 'Tip',
        icon: <TickCircle size={16} variant="Bold" />,
    },
};

export function Callout({
    variant = 'info',
    title,
    children,
}: {
    variant?: CalloutVariant;
    title?: string;
    children: React.ReactNode;
}) {
    const styles = CALLOUT_STYLES[variant];
    return (
        <div className={`not-prose my-6 flex gap-3 rounded-2xl border ${styles.border} ${styles.bg} px-4 py-4 shadow-[0_8px_24px_rgba(18,38,58,0.05)]`}>
            <span className={`mt-0.5 shrink-0 ${styles.iconColor}`}>{styles.icon}</span>
            <div className="text-sm leading-relaxed">
                {title ? (
                    <p className={`mb-1 font-bold ${styles.labelColor}`}>{title}</p>
                ) : (
                    <span className={`font-bold ${styles.labelColor}`}>{styles.label}: </span>
                )}
                <span className="text-gray-700">{children}</span>
            </div>
        </div>
    );
}

// ─── CodeGroup ────────────────────────────────────────────────────────────────

export function CodeGroup({
    tabs,
    children,
}: {
    tabs: string[];
    children: React.ReactNode;
}) {
    const [activeTab, setActiveTab] = useState(0);
    const childArray = React.Children.toArray(children);

    return (
        <div className="not-prose my-6 rounded-2xl overflow-hidden border border-white/10 bg-[#0d1117] shadow-lg">
            {/* Tab bar */}
            <div className="flex items-center gap-0.5 bg-white/5 px-4 pt-3 pb-0 border-b border-white/10">
                {tabs.map((tab, i) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(i)}
                        className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-all ${
                            activeTab === i
                                ? 'bg-[#0d1117] text-white border-x border-t border-white/10 -mb-px'
                                : 'text-gray-500 hover:text-gray-300'
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>
            {/* Active panel */}
            <div className="p-5 overflow-x-auto">
                <pre className="text-sm font-mono leading-relaxed text-gray-100 m-0">
                    {childArray[activeTab]}
                </pre>
            </div>
        </div>
    );
}

// ─── EndpointBadge ────────────────────────────────────────────────────────────

const METHOD_STYLES: Record<string, string> = {
    GET: 'bg-blue-100 text-blue-700',
    POST: 'bg-green-100 text-green-700',
    PUT: 'bg-amber-100 text-amber-700',
    PATCH: 'bg-purple-100 text-purple-700',
    DELETE: 'bg-red-100 text-red-700',
};

export function EndpointBadge({ method, path }: { method: string; path: string }) {
    const methodStyle = METHOD_STYLES[method.toUpperCase()] ?? 'bg-gray-100 text-gray-700';
    return (
        <div className="not-prose my-4 flex items-center gap-3 rounded-xl border border-black/8 bg-gray-50 px-4 py-3 font-mono">
            <span className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${methodStyle}`}>
                {method.toUpperCase()}
            </span>
            <span className="text-sm font-medium text-[var(--color-brand-navy)] break-all">{path}</span>
        </div>
    );
}

// ─── ParamTable ───────────────────────────────────────────────────────────────

export type Param = {
    name: string;
    type: string;
    required?: boolean;
    description: string;
};

export function ParamTable({ params }: { params: Param[] }) {
    return (
        <div className="not-prose my-6 overflow-hidden rounded-xl border border-black/8">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-gray-50 border-b border-black/5">
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 w-40">Parameter</th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 w-28">Type</th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 w-20">Required</th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500">Description</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                    {params.map((param) => (
                        <tr key={param.name} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3">
                                <code className="font-mono text-xs bg-orange-50 text-[var(--color-brand-orange)] px-1.5 py-0.5 rounded font-semibold">
                                    {param.name}
                                </code>
                            </td>
                            <td className="px-4 py-3">
                                <span className="font-mono text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                    {param.type}
                                </span>
                            </td>
                            <td className="px-4 py-3">
                                {param.required ? (
                                    <span className="text-xs font-bold text-red-500">required</span>
                                ) : (
                                    <span className="text-xs text-gray-400">optional</span>
                                )}
                            </td>
                            <td className="px-4 py-3 text-gray-600 leading-relaxed">{param.description}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── ResponseExample ──────────────────────────────────────────────────────────

export function ResponseExample({
    title = 'Response',
    children,
}: {
    title?: string;
    children: React.ReactNode;
}) {
    const [copied, setCopied] = useState(false);
    const codeRef = useRef<HTMLPreElement>(null);

    const handleCopy = () => {
        const text = codeRef.current?.textContent ?? '';
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="not-prose my-6 rounded-2xl overflow-hidden bg-[#0d1117] border border-white/10 shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/5">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</span>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/10"
                    aria-label="Copy to clipboard"
                >
                    {copied ? (
                        <>
                            <TickSquare size={13} variant="Bold" className="text-green-400" />
                            <span className="text-green-400">Copied</span>
                        </>
                    ) : (
                        <>
                            <Copy size={13} />
                            Copy
                        </>
                    )}
                </button>
            </div>
            {/* Code */}
            <div className="overflow-x-auto">
                <pre
                    ref={codeRef}
                    className="p-5 text-sm font-mono leading-relaxed text-gray-100 m-0 bg-transparent"
                >
                    {children}
                </pre>
            </div>
        </div>
    );
}

// ─── Steps ────────────────────────────────────────────────────────────────────

export function Steps({ children }: { children: React.ReactNode }) {
    return (
        <div className="not-prose my-8 space-y-0">
            {children}
        </div>
    );
}

export function Step({
    n,
    title,
    children,
}: {
    n: number;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex gap-5 pb-8 last:pb-0">
            <div className="flex flex-col items-center shrink-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-brand-navy)] text-sm font-black text-white shadow-[3px_3px_0px_0px_rgba(255,92,22,0.3)]">
                    {n}
                </div>
                <div className="mt-3 w-0.5 flex-1 bg-gradient-to-b from-gray-300 to-transparent" />
            </div>
            <div className="flex-1 pb-0 pt-1">
                <h4 className="text-base font-black text-[var(--color-brand-navy)] mb-3">{title}</h4>
                <div className="text-sm text-gray-600 leading-relaxed space-y-3
                    [&_code]:bg-orange-50 [&_code]:text-[var(--color-brand-orange)] [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_code]:font-mono [&_code]:font-semibold
                    [&_pre]:my-4 [&_pre]:rounded-xl [&_pre]:bg-[#0d1117] [&_pre]:text-gray-100 [&_pre]:p-4 [&_pre]:text-xs [&_pre]:overflow-x-auto
                ">
                    {children}
                </div>
            </div>
        </div>
    );
}

// ─── PaymentFlowDiagram ───────────────────────────────────────────────────────

type FlowActor = 'app' | 'user' | 'coal' | 'chain';

const FLOW_ACTOR_STYLES: Record<FlowActor, string> = {
    app:   'bg-blue-50 text-blue-700 border-blue-200',
    user:  'bg-green-50 text-green-700 border-green-200',
    coal:  'bg-orange-50 text-[#FF5C16] border-orange-200',
    chain: 'bg-purple-50 text-purple-700 border-purple-200',
};

const FLOW_ACTOR_LABELS: Record<FlowActor, string> = {
    app:   'Your App',
    user:  'User / Browser',
    coal:  'Coal',
    chain: 'Base Chain',
};

export type FlowRow =
    | { kind: 'msg'; from: FlowActor; to: FlowActor; label: string; sub?: string }
    | { kind: 'event'; actor: FlowActor; label: string }
    | { kind: 'phase'; label: string };

export function PaymentFlowDiagram({ rows }: { rows: FlowRow[] }) {
    return (
        <div className="not-prose my-6 rounded-2xl border border-black/8 bg-white overflow-hidden shadow-sm text-sm">
            {rows.map((row, i) => {
                if (row.kind === 'phase') {
                    return (
                        <div key={i} className="flex items-center gap-3 px-5 py-2 bg-gray-50 border-y border-black/5">
                            <div className="flex-1 h-px bg-gray-200" />
                            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">{row.label}</span>
                            <div className="flex-1 h-px bg-gray-200" />
                        </div>
                    );
                }
                if (row.kind === 'event') {
                    return (
                        <div key={i} className="flex items-center gap-3 px-5 py-2.5 border-b border-black/4 last:border-0">
                            <span className={`shrink-0 text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full border ${FLOW_ACTOR_STYLES[row.actor]}`}>
                                {FLOW_ACTOR_LABELS[row.actor]}
                            </span>
                            <span className="text-xs text-gray-500 italic">{row.label}</span>
                        </div>
                    );
                }
                // msg
                const arrow = '→';
                return (
                    <div key={i} className="flex items-start gap-3 px-5 py-2.5 border-b border-black/4 last:border-0 hover:bg-gray-50/50 transition-colors">
                        <span className={`shrink-0 text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full border ${FLOW_ACTOR_STYLES[row.from]}`}>
                            {FLOW_ACTOR_LABELS[row.from]}
                        </span>
                        <span className="shrink-0 text-gray-300 text-base mt-0.5">→</span>
                        <span className={`shrink-0 text-[10px] font-black uppercase tracking-wide px-2.5 py-1 rounded-full border ${FLOW_ACTOR_STYLES[row.to]}`}>
                            {FLOW_ACTOR_LABELS[row.to]}
                        </span>
                        <div className="flex-1 min-w-0">
                            <span className="font-semibold text-[var(--color-brand-navy)] font-mono text-xs">{row.label}</span>
                            {row.sub && <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{row.sub}</p>}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── QuickLinks ───────────────────────────────────────────────────────────────

export function QuickLinks({ items }: { items: { title: string; description: string; href: string }[] }) {
    return (
        <div className="not-prose my-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.map((item) => (
                <Link
                    key={item.href}
                    href={item.href}
                    className="group flex flex-col gap-2 rounded-2xl border-2 border-black/5 bg-white p-5 transition-all hover:border-[var(--color-brand-orange)]/30 hover:shadow-md hover:-translate-y-0.5"
                >
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-[var(--color-brand-navy)] text-sm">{item.title}</span>
                        <ArrowRight size={16} className="text-gray-300 group-hover:text-[var(--color-brand-orange)] transition-colors" />
                    </div>
                    <span className="text-xs text-gray-500 leading-relaxed">{item.description}</span>
                </Link>
            ))}
        </div>
    );
}
