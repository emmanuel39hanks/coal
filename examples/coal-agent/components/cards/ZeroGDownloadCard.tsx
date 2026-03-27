'use client';

import { useState } from 'react';
import { isSafeImageUrl } from '@/lib/types';

export function ZeroGDownloadCard({ data }: { data: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false);
  const artifactData = data.data as Record<string, unknown> | undefined;
  const isEncrypted = data.isEncrypted as boolean;
  const schema = data.schema as string | null;

  return (
    <div className="border border-black/5 rounded-2xl bg-white overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
          <span className="text-sm font-bold text-[var(--brand-navy)]">0G Storage Download</span>
        </div>
        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-mono font-semibold">
          {data.label as string || 'Artifact'}
        </span>
      </div>
      <div className="px-4 py-3 space-y-2 text-sm">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="text-[var(--muted)]">Root Hash</div>
          <div className="font-mono text-[var(--brand-navy)] truncate">{(data.rootHash as string)?.slice(0, 18)}...</div>
          <div className="text-[var(--muted)]">Schema</div>
          <div className="font-mono text-[var(--brand-navy)]">{schema || (isEncrypted ? 'encrypted' : 'unknown')}</div>
          <div className="text-[var(--muted)]">Size</div>
          <div className="text-[var(--brand-navy)]">{((data.byteSize as number) / 1024).toFixed(1)} KB</div>
          <div className="text-[var(--muted)]">Download</div>
          <div className="text-[var(--brand-navy)]">{data.durationMs as number}ms ({data.throughputMbps as number} Mbps)</div>
          <div className="text-[var(--muted)]">Encrypted</div>
          <div>{isEncrypted ? <span className="text-[var(--warning)] font-semibold">Yes (AES-256-GCM)</span> : <span className="text-[var(--success)] font-semibold">No (public)</span>}</div>
        </div>

        {schema === 'coal.merchant_profile.v1' && artifactData && (
          <div className="mt-3 pt-3 border-t border-black/5">
            <div className="text-xs font-bold text-[var(--accent)] mb-2">Merchant Profile</div>
            <div className="text-xs space-y-1 text-[var(--brand-navy)]">
              <div><span className="text-[var(--muted)]">Name:</span> {artifactData.name as string}</div>
              <div><span className="text-[var(--muted)]">Products:</span> {artifactData.productCount as number}</div>
              {(artifactData.topProducts as Array<{ name: string; price: string; image?: string }>)?.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {(artifactData.topProducts as Array<{ name: string; price: string; image?: string }>).map((p, i) => (
                    <div key={i} className="flex items-center gap-2.5 p-1.5 rounded-lg bg-[var(--background)]">
                      {isSafeImageUrl(p.image) ? (
                        <img src={p.image} alt={p.name} className="w-8 h-8 rounded-md object-cover flex-none" />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-black/5 flex items-center justify-center flex-none text-sm">
                          &#x1f4e6;
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="font-semibold truncate block">{p.name}</span>
                        <span className="text-[var(--muted)]">${p.price}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div><span className="text-[var(--muted)]">Networks:</span> {(artifactData.supportedNetworks as Array<{ name: string }>)?.map(n => n.name).join(', ')}</div>
              <div><span className="text-[var(--muted)]">Tokens:</span> {(artifactData.supportedTokens as Array<{ symbol: string }>)?.map(t => t.symbol).join(', ')}</div>
              <div className="flex gap-1 flex-wrap mt-1">
                {Object.entries((artifactData.capabilities || {}) as Record<string, boolean>).filter(([, v]) => v).map(([k]) => (
                  <span key={k} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] font-semibold">{k}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {schema === 'coal.receipt.v1' && artifactData && (
          <div className="mt-3 pt-3 border-t border-black/5">
            <div className="text-xs font-bold text-[var(--accent)] mb-2">Payment Receipt</div>
            <div className="text-xs space-y-1 text-[var(--brand-navy)]">
              <div><span className="text-[var(--muted)]">Amount:</span> {artifactData.amount as string} {artifactData.currency as string}</div>
              <div><span className="text-[var(--muted)]">Description:</span> {artifactData.description as string || 'N/A'}</div>
              <div><span className="text-[var(--muted)]">Merchant:</span> {artifactData.merchantName as string}</div>
              {!!(artifactData.transaction as Record<string, unknown>)?.hash && (
                <div><span className="text-[var(--muted)]">Tx:</span> <span className="font-mono">{((artifactData.transaction as Record<string, unknown>).hash as string)?.slice(0, 18)}...</span></div>
              )}
            </div>
          </div>
        )}

        {isEncrypted && (
          <div className="mt-3 pt-3 border-t border-black/5">
            <div className="text-xs font-bold text-[var(--warning)] mb-1">Encrypted Envelope</div>
            <p className="text-[11px] text-[var(--muted)]">
              This data is AES-256-GCM encrypted. Only Coal can decrypt it via the Memory Query API.
              Agents use POST /api/agent/memory/query to ask questions without seeing raw data.
            </p>
          </div>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-[var(--accent)] hover:underline mt-2 font-semibold"
        >
          {expanded ? 'Hide raw JSON' : 'Show raw JSON'}
        </button>
        {expanded && (
          <pre className="text-[10px] font-mono bg-[var(--brand-navy)] text-white/80 p-3 rounded-xl overflow-x-auto max-h-60 overflow-y-auto">
            {JSON.stringify(artifactData, null, 2)}
          </pre>
        )}
      </div>
      <div className="px-4 py-2 bg-[var(--accent)]/5 text-[10px] text-[var(--accent)] flex items-center gap-1.5 font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
        Downloaded from 0G Storage mainnet (decentralized, no Coal API)
      </div>
    </div>
  );
}
