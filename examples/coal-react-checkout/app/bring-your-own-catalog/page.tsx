'use client';

/**
 * Demo: "Bring your own catalog"
 *
 * Shows how a merchant with products in their own backend (Shopify, Sanity,
 * a custom Postgres DB, whatever) integrates Coal with ONE component.
 *
 * On mount, <CoalAgentPublisher> POSTs the local catalog to a merchant-owned
 * proxy route (/api/coal/publish-catalog in this example) which internally
 * calls publishCoalCatalog() from coal-react/server with a server-side API
 * key. Coal upserts the products into its index, publishes the merchant
 * profile to 0G Storage (Log layer), mirrors it to 0G KV for live discovery,
 * and every AI agent hitting api.usecoal.xyz/api/agent/discover finds them.
 *
 * No migration. No console use. Three lines of integration.
 */

import { CoalAgentPublisher, CoalProvider } from 'coal-react';

const LOCAL_PRODUCTS = [
    {
        externalId: 'byo-report-q2-2026',
        name: 'Q2 2026 Crypto Market Report',
        description:
            'Quarterly analysis of stablecoin flows, DEX volume, and agent payment adoption.',
        price: 19.99,
        image: 'https://picsum.photos/seed/report/400/400',
        tags: ['research', 'quarterly'],
    },
    {
        externalId: 'byo-prompt-library',
        name: 'AI Commerce Prompt Library',
        description:
            'Curated collection of 200+ prompts for building AI commerce agents.',
        price: 9.99,
        image: 'https://picsum.photos/seed/prompts/400/400',
        tags: ['ai', 'prompts'],
    },
    {
        externalId: 'byo-api-pro-plan',
        name: 'API Pro Plan',
        description: 'Unlimited calls to the Saint analytics API.',
        price: 29.0,
        image: 'https://picsum.photos/seed/api/400/400',
        tags: ['api', 'subscription'],
        billingType: 'subscription' as const,
        billingInterval: 'month' as const,
    },
];

// In a real app this comes from process.env.NEXT_PUBLIC_COAL_MERCHANT_ID or
// a merchant-specific config. For the demo we use the Saint merchant ID.
const MERCHANT_ID =
    process.env.NEXT_PUBLIC_COAL_MERCHANT_ID || 'lst00PqEWRwcM4roiOcSpD8WfxlBc2hH';

export default function BringYourOwnCatalogPage() {
    return (
        <CoalProvider merchantId={MERCHANT_ID}>
            <main style={{ maxWidth: '880px', margin: '0 auto', padding: '48px 24px' }}>
                <div style={{ marginBottom: '32px' }}>
                    <span
                        style={{
                            display: 'inline-block',
                            padding: '4px 12px',
                            borderRadius: '999px',
                            background: '#fce7f3',
                            color: '#db2777',
                            fontSize: '11px',
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            marginBottom: '12px',
                        }}
                    >
                        CATALOG INDEXING AS A SERVICE
                    </span>
                    <h1
                        style={{
                            fontSize: '32px',
                            fontWeight: 900,
                            color: '#180D43',
                            margin: '0 0 8px',
                            letterSpacing: '-0.02em',
                        }}
                    >
                        Bring your own catalog
                    </h1>
                    <p style={{ fontSize: '15px', color: '#6b7280', lineHeight: 1.6 }}>
                        Your products can live anywhere — a Postgres table, a Sanity CMS,
                        a Shopify store, this JSON file right here. Drop{' '}
                        <code
                            style={{
                                background: 'rgba(0,0,0,0.05)',
                                padding: '2px 6px',
                                borderRadius: '6px',
                                fontFamily: 'monospace',
                            }}
                        >
                            &lt;CoalAgentPublisher&gt;
                        </code>{' '}
                        into your page and they&rsquo;re indexed on 0G for agent
                        discovery. One component. Zero migration.
                    </p>
                </div>

                {/*
                 * The publisher component. This runs on mount and whenever
                 * `products` changes (debounced to 30s by default). It POSTs
                 * the catalog to our own /api/coal/publish-catalog route,
                 * which calls publishCoalCatalog() on the server with the
                 * Coal API key kept server-side.
                 *
                 * The `headers` prop sends a demo-grade shared secret so the
                 * proxy route can reject drive-by attackers. In production
                 * replace this with a real CSRF token, a session cookie, or
                 * scrap the browser path entirely and publish from a
                 * server-side webhook. See the comment block at the top of
                 * app/api/coal/publish-catalog/route.ts for the full picture.
                 */}
                <CoalAgentPublisher
                    products={LOCAL_PRODUCTS}
                    proxyUrl="/api/coal/publish-catalog"
                    mode="upsert"
                    headers={{
                        'x-coal-publish-secret':
                            process.env.NEXT_PUBLIC_COAL_PUBLISH_PROXY_SECRET || '',
                    }}
                    showStatus
                    onPublish={(result) => {
                        if (typeof window !== 'undefined') {
                            console.log('[CoalAgentPublisher] Published:', result);
                        }
                    }}
                    onError={(err) => {
                        if (typeof window !== 'undefined') {
                            console.error('[CoalAgentPublisher]', err);
                        }
                    }}
                />

                {/* Render the local catalog from the merchant's own state */}
                <div style={{ marginTop: '40px' }}>
                    <h2
                        style={{
                            fontSize: '14px',
                            fontWeight: 800,
                            color: '#6b7280',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            marginBottom: '16px',
                        }}
                    >
                        Your local products
                    </h2>
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                            gap: '16px',
                        }}
                    >
                        {LOCAL_PRODUCTS.map((p) => (
                            <div
                                key={p.externalId}
                                style={{
                                    borderRadius: '20px',
                                    border: '1px solid rgba(0,0,0,0.06)',
                                    background: '#fff',
                                    overflow: 'hidden',
                                }}
                            >
                                {p.image && (
                                    <div style={{ aspectRatio: '1 / 1', background: '#f5f5f5' }}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={p.image}
                                            alt={p.name}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                objectFit: 'cover',
                                            }}
                                        />
                                    </div>
                                )}
                                <div style={{ padding: '14px 16px' }}>
                                    <div
                                        style={{
                                            fontSize: '14px',
                                            fontWeight: 700,
                                            color: '#180d43',
                                        }}
                                    >
                                        {p.name}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: '11px',
                                            color: '#6b7280',
                                            marginTop: '4px',
                                            minHeight: '28px',
                                        }}
                                    >
                                        {p.description}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: '13px',
                                            fontWeight: 800,
                                            color: '#FF5C16',
                                            marginTop: '8px',
                                        }}
                                    >
                                        ${p.price} USDC
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div
                    style={{
                        marginTop: '48px',
                        padding: '24px',
                        borderRadius: '20px',
                        background: 'rgba(0,0,0,0.03)',
                        border: '1px solid rgba(0,0,0,0.06)',
                    }}
                >
                    <h3
                        style={{
                            fontSize: '14px',
                            fontWeight: 800,
                            color: '#180D43',
                            margin: '0 0 12px',
                        }}
                    >
                        What just happened
                    </h3>
                    <ol
                        style={{
                            margin: 0,
                            paddingLeft: '20px',
                            fontSize: '13px',
                            color: '#4b5563',
                            lineHeight: 1.7,
                        }}
                    >
                        <li>
                            <code>&lt;CoalAgentPublisher&gt;</code> POSTed these products to{' '}
                            <code>/api/coal/publish-catalog</code> on this site&rsquo;s server.
                        </li>
                        <li>
                            That route called{' '}
                            <code>publishCoalCatalog()</code> from{' '}
                            <code>coal-react/server</code> with the server-side API key.
                        </li>
                        <li>
                            Coal upserted the products into its index (keyed by{' '}
                            <code>externalId</code>, so republishes are idempotent).
                        </li>
                        <li>
                            Coal re-published the merchant profile to 0G Storage (immutable Log
                            layer) and mirrored it to 0G KV (live agent discovery layer).
                        </li>
                        <li>
                            Any AI agent hitting{' '}
                            <code>api.usecoal.xyz/api/agent/discover</code> now finds these
                            products.
                        </li>
                    </ol>
                </div>

                <div style={{ marginTop: '32px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <a
                        href="/.well-known/agent-card.json"
                        style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: '#FF5C16',
                            textDecoration: 'none',
                            padding: '10px 16px',
                            borderRadius: '999px',
                            border: '1.5px solid #FF5C16',
                        }}
                    >
                        View /.well-known/agent-card.json →
                    </a>
                    <a
                        href="/llms.txt"
                        style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: '#FF5C16',
                            textDecoration: 'none',
                            padding: '10px 16px',
                            borderRadius: '999px',
                            border: '1.5px solid #FF5C16',
                        }}
                    >
                        View /llms.txt →
                    </a>
                    <a
                        href="/.well-known/x402.json"
                        style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: '#FF5C16',
                            textDecoration: 'none',
                            padding: '10px 16px',
                            borderRadius: '999px',
                            border: '1.5px solid #FF5C16',
                        }}
                    >
                        View /.well-known/x402.json →
                    </a>
                </div>
            </main>
        </CoalProvider>
    );
}
