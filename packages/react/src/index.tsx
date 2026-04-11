import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_COAL_BASE_URL = 'https://usecoal.xyz';
const DEFAULT_COAL_API_URL = 'https://api.usecoal.xyz';

// ---------------------------------------------------------------------------
// CoalProvider context
// ---------------------------------------------------------------------------
// Merchants wrap their Next.js app in <CoalProvider> so nested components can
// read the merchant ID and API base URL without prop drilling. The provider
// holds NO secrets — API keys never belong in the client bundle.

export interface CoalContextValue {
  /** Coal merchant ID. */
  merchantId: string;
  /** Coal API base URL (defaults to https://api.usecoal.xyz). */
  apiUrl: string;
  /** Coal frontend base URL used for hosted checkout redirects. */
  baseUrl: string;
}

const CoalContext = React.createContext<CoalContextValue | null>(null);

export interface CoalProviderProps {
  merchantId: string;
  /** Coal API base URL. Defaults to 'https://api.usecoal.xyz'. */
  apiUrl?: string;
  /** Coal frontend base URL. Defaults to 'https://usecoal.xyz'. */
  baseUrl?: string;
  children: React.ReactNode;
}

/**
 * Wraps a subtree with Coal configuration. Place at the root of your Next.js
 * app. Safe to render on the server.
 *
 * @example
 *   // app/layout.tsx
 *   import { CoalProvider } from 'coal-react';
 *
 *   export default function Root({ children }) {
 *     return (
 *       <html>
 *         <body>
 *           <CoalProvider merchantId="lst00PqE...">
 *             {children}
 *           </CoalProvider>
 *         </body>
 *       </html>
 *     );
 *   }
 */
export function CoalProvider({
  merchantId,
  apiUrl = DEFAULT_COAL_API_URL,
  baseUrl = DEFAULT_COAL_BASE_URL,
  children,
}: CoalProviderProps): React.ReactElement {
  const value = useMemo<CoalContextValue>(
    () => ({ merchantId, apiUrl, baseUrl }),
    [merchantId, apiUrl, baseUrl],
  );
  return <CoalContext.Provider value={value}>{children}</CoalContext.Provider>;
}

/**
 * Internal hook for reading the Coal context. Throws if no provider is mounted.
 */
function useCoal(): CoalContextValue {
  const ctx = React.useContext(CoalContext);
  if (!ctx) {
    throw new Error(
      '[coal-react] useCoal / Coal components must be used inside <CoalProvider>. ' +
        'Wrap your app root with <CoalProvider merchantId="..."> first.',
    );
  }
  return ctx;
}

/**
 * Optional variant — returns null if there is no provider. Useful for the
 * one-off button path where a merchant passes props directly.
 */
function useCoalOptional(): CoalContextValue | null {
  return React.useContext(CoalContext);
}

// ---------------------------------------------------------------------------
// Types — shared across components
// ---------------------------------------------------------------------------

export interface CoalProductSummary {
  id: string;
  name: string;
  price: string;
  image?: string | null;
  description?: string | null;
}

export interface CoalPaywallSummary {
  id: string;
  name: string;
  price: string;
  currency: string;
  pricingModel?: string;
  contentType?: string;
  description?: string | null;
  verifyUrl?: string;
}

export interface CoalMerchantProfile {
  merchantId: string;
  name?: string | null;
  productCount?: number;
  paywallCount?: number;
  topProducts?: CoalProductSummary[];
  topPaywalls?: CoalPaywallSummary[];
  supportedTokens?: Array<{ address: string; symbol: string; decimals: number }>;
  zeroG?: {
    published?: boolean;
    storageUri?: string | null;
    storageRoot?: string | null;
  };
}

// ---------------------------------------------------------------------------
// useCoalMerchantProfile — internal hook that caches the merchant profile
// ---------------------------------------------------------------------------

interface MerchantProfileState {
  profile: CoalMerchantProfile | null;
  loading: boolean;
  error: string | null;
}

function useCoalMerchantProfile(merchantIdOverride?: string): MerchantProfileState {
  const ctx = useCoal();
  const merchantId = merchantIdOverride ?? ctx.merchantId;
  const [state, setState] = useState<MerchantProfileState>({
    profile: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ profile: null, loading: true, error: null });

    fetch(`${ctx.apiUrl}/api/agent/merchant-profiles/${encodeURIComponent(merchantId)}`, {
      headers: { accept: 'application/json' },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Coal API returned ${res.status}`);
        const data = (await res.json()) as {
          merchantId: string;
          profile: Record<string, unknown>;
          zeroG?: Record<string, unknown>;
        };
        if (cancelled) return;
        setState({
          profile: {
            merchantId: data.merchantId,
            ...(data.profile as unknown as Omit<CoalMerchantProfile, 'merchantId'>),
            zeroG: data.zeroG as CoalMerchantProfile['zeroG'],
          },
          loading: false,
          error: null,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Failed to load merchant profile';
        setState({ profile: null, loading: false, error: message });
      });

    return () => {
      cancelled = true;
    };
  }, [ctx.apiUrl, merchantId]);

  return state;
}

// ---------------------------------------------------------------------------
// Legacy: CoalCheckoutButton + useCoalCheckout (kept for backwards compat)
// ---------------------------------------------------------------------------

export interface CoalCheckoutButtonProps {
  /** The checkout URL returned by your server's create-session call. Preferred. */
  checkoutUrl?: string;
  /** Alternative: pass sessionId + baseUrl and the URL will be constructed. */
  sessionId?: string;
  /** Coal frontend base URL. Defaults to the provider's baseUrl or 'https://usecoal.xyz'. */
  baseUrl?: string;
  /** Where to open the checkout. '_self' redirects, '_blank' opens a new tab. */
  target?: '_self' | '_blank';
  /** Fired immediately before the redirect/open. Use for analytics. */
  onBeforeRedirect?: () => void;
  /** Button content. Defaults to a styled "Pay with Coal" label. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export interface UseCoalCheckoutOptions {
  checkoutUrl?: string;
  sessionId?: string;
  baseUrl?: string;
}

export interface UseCoalCheckoutReturn {
  checkoutUrl: string | null;
  redirectToCheckout: () => void;
  openCheckout: () => void;
}

function resolveCheckoutUrl(
  opts: Pick<UseCoalCheckoutOptions, 'checkoutUrl' | 'sessionId' | 'baseUrl'>,
  fallbackBaseUrl?: string,
): string | null {
  if (opts.checkoutUrl) return opts.checkoutUrl;
  if (opts.sessionId) {
    const base = (opts.baseUrl ?? fallbackBaseUrl ?? DEFAULT_COAL_BASE_URL).replace(/\/$/, '');
    return `${base}/pay/checkout/${encodeURIComponent(opts.sessionId)}`;
  }
  return null;
}

const DEFAULT_BUTTON_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '12px 24px',
  borderRadius: '999px',
  background: '#000',
  color: '#fff',
  fontSize: '14px',
  fontWeight: 700,
  border: 'none',
  cursor: 'pointer',
  boxShadow: '4px 4px 0px 0px #FF5C16',
  transition: 'all 0.15s ease',
  textDecoration: 'none',
  fontFamily: 'inherit',
};

const HOVER_STYLE_DELTA: React.CSSProperties = {
  transform: 'translate(2px, 2px)',
  boxShadow: '2px 2px 0px 0px #FF5C16',
};

export function CoalCheckoutButton({
  checkoutUrl,
  sessionId,
  baseUrl,
  target = '_self',
  onBeforeRedirect,
  children,
  className,
  style,
}: CoalCheckoutButtonProps): React.ReactElement {
  const ctx = useCoalOptional();
  const url = resolveCheckoutUrl({ checkoutUrl, sessionId, baseUrl }, ctx?.baseUrl);
  const [hovered, setHovered] = useState(false);

  const handleClick = useCallback(() => {
    if (!url) {
      console.error('[CoalCheckoutButton] No checkoutUrl or sessionId provided.');
      return;
    }
    onBeforeRedirect?.();
    if (target === '_blank') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = url;
    }
  }, [url, target, onBeforeRedirect]);

  const mergedStyle: React.CSSProperties = {
    ...DEFAULT_BUTTON_STYLE,
    ...(hovered ? HOVER_STYLE_DELTA : {}),
    ...style,
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={className}
      style={mergedStyle}
      disabled={!url}
    >
      {children ?? (
        <>
          <CoalLogo />
          Pay with Coal
        </>
      )}
    </button>
  );
}

export function useCoalCheckout(options: UseCoalCheckoutOptions): UseCoalCheckoutReturn {
  const ctx = useCoalOptional();
  const url = resolveCheckoutUrl(options, ctx?.baseUrl);

  const redirectToCheckout = useCallback(() => {
    if (!url) {
      console.error('[useCoalCheckout] No checkoutUrl or sessionId provided.');
      return;
    }
    window.location.href = url;
  }, [url]);

  const openCheckout = useCallback(() => {
    if (!url) {
      console.error('[useCoalCheckout] No checkoutUrl or sessionId provided.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [url]);

  return { checkoutUrl: url, redirectToCheckout, openCheckout };
}

// ---------------------------------------------------------------------------
// CoalBuyButton — high-level wrapper that expects a server-created session
// ---------------------------------------------------------------------------
// The canonical "Buy" button. The merchant passes a `createSession` callback
// that runs on their own server (via a Next.js server action or API route)
// using their secret Coal API key. The callback returns a checkout URL which
// the button redirects to. Keeps secrets out of the browser.

export interface CoalBuyButtonProps {
  /** Called on click. Runs on the merchant's own server (action / API route)
   *  and must return the Coal-hosted checkout URL or a session ID. */
  createSession: () =>
    | Promise<{ url?: string; sessionId?: string; id?: string }>
    | { url?: string; sessionId?: string; id?: string };
  /** Frontend base URL override (defaults to provider or 'https://usecoal.xyz'). */
  baseUrl?: string;
  /** '_self' (default) or '_blank'. */
  target?: '_self' | '_blank';
  /** Button content. Defaults to "Pay with Coal". */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Called on unexpected errors (createSession throws, etc.). */
  onError?: (error: Error) => void;
}

export function CoalBuyButton({
  createSession,
  baseUrl,
  target = '_self',
  children,
  className,
  style,
  onError,
}: CoalBuyButtonProps): React.ReactElement {
  const ctx = useCoalOptional();
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleClick = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await createSession();
      const url =
        result?.url ??
        resolveCheckoutUrl(
          { sessionId: result?.sessionId ?? result?.id, baseUrl },
          ctx?.baseUrl,
        );
      if (!url) {
        throw new Error('createSession did not return a url, sessionId, or id');
      }
      if (target === '_blank') {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = url;
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      onError?.(error);
      console.error('[CoalBuyButton]', error);
    } finally {
      setLoading(false);
    }
  }, [loading, createSession, baseUrl, ctx?.baseUrl, target, onError]);

  const mergedStyle: React.CSSProperties = {
    ...DEFAULT_BUTTON_STYLE,
    ...(hovered ? HOVER_STYLE_DELTA : {}),
    ...(loading ? { opacity: 0.7, cursor: 'wait' } : {}),
    ...style,
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={className}
      style={mergedStyle}
      disabled={loading}
    >
      {children ?? (
        <>
          <CoalLogo />
          {loading ? 'Redirecting…' : 'Pay with Coal'}
        </>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// CoalProducts — grid/list of products from a merchant's profile
// ---------------------------------------------------------------------------

export interface CoalProductsProps {
  /** Override the merchant ID. Defaults to the provider's merchantId. */
  merchantId?: string;
  /** Layout: grid (default) or list. */
  layout?: 'grid' | 'list';
  /** Number of columns for grid layout. Default 3. */
  columns?: number;
  /** Optional render override. If provided, replaces the default card UI. */
  renderProduct?: (product: CoalProductSummary) => React.ReactNode;
  /** Content shown while fetching. */
  loadingContent?: React.ReactNode;
  /** Content shown if the profile fails to load. */
  errorContent?: (error: string) => React.ReactNode;
  /** Content shown when the merchant has no products. */
  emptyContent?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function CoalProducts({
  merchantId,
  layout = 'grid',
  columns = 3,
  renderProduct,
  loadingContent,
  errorContent,
  emptyContent,
  className,
  style,
}: CoalProductsProps): React.ReactElement {
  const { profile, loading, error } = useCoalMerchantProfile(merchantId);

  if (loading) return <>{loadingContent ?? <CoalLoading />}</>;
  if (error) return <>{errorContent ? errorContent(error) : <CoalError message={error} />}</>;
  const products = profile?.topProducts ?? [];
  if (products.length === 0) return <>{emptyContent ?? <CoalEmpty label="No products yet" />}</>;

  const gridStyle: React.CSSProperties =
    layout === 'grid'
      ? {
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: '16px',
          ...style,
        }
      : {
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          ...style,
        };

  return (
    <div className={className} style={gridStyle}>
      {products.map((p) => (
        <React.Fragment key={p.id}>
          {renderProduct ? renderProduct(p) : <CoalProductCard product={p} />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CoalProduct — single product card by ID
// ---------------------------------------------------------------------------

export interface CoalProductProps {
  /** Product ID to render. */
  id: string;
  /** Override the merchant ID. Defaults to the provider's merchantId. */
  merchantId?: string;
  /** Custom render override. */
  render?: (product: CoalProductSummary) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function CoalProduct({
  id,
  merchantId,
  render,
  className,
  style,
}: CoalProductProps): React.ReactElement {
  const { profile, loading, error } = useCoalMerchantProfile(merchantId);
  const product = profile?.topProducts?.find((p) => p.id === id);

  if (loading) return <CoalLoading />;
  if (error) return <CoalError message={error} />;
  if (!product) return <CoalEmpty label="Product not found" />;

  if (render) return <>{render(product)}</>;
  return (
    <div className={className} style={style}>
      <CoalProductCard product={product} />
    </div>
  );
}

// Default product card used by CoalProducts + CoalProduct when no render override.
function CoalProductCard({ product }: { product: CoalProductSummary }): React.ReactElement {
  return (
    <div
      style={{
        borderRadius: '20px',
        border: '1px solid rgba(0,0,0,0.06)',
        background: '#fff',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {product.image && (
        <div style={{ aspectRatio: '1 / 1', background: '#f5f5f5' }}>
          <img
            src={product.image}
            alt={product.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      )}
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#180d43' }}>
          {product.name}
        </div>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 800,
            color: '#FF5C16',
            marginTop: '4px',
          }}
        >
          ${product.price} USDC
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CoalAgentPublisher — client-side catalog publisher (proxies through merchant)
// ---------------------------------------------------------------------------
// The client variant NEVER sees the Coal API key. It POSTs the catalog to a
// merchant-owned server route (default: /api/coal/publish-catalog) which is
// expected to use publishCoalCatalog() from 'coal-react/server' internally.
// This keeps the API key out of the browser bundle.

export interface CoalAgentPublisherProduct {
  externalId: string;
  name: string;
  description?: string;
  price: number | string;
  image?: string;
  images?: string[];
  sku?: string;
  tags?: string[];
  billingType?: 'one_time' | 'subscription';
  billingInterval?: 'day' | 'week' | 'month' | 'year';
  billingIntervalCount?: number;
}

export interface CoalAgentPublisherProps {
  /** Products to publish. Published on mount and whenever this array changes. */
  products: CoalAgentPublisherProduct[];
  /** Merchant-owned proxy route that internally calls publishCoalCatalog().
   *  Defaults to '/api/coal/publish-catalog'. */
  proxyUrl?: string;
  /** Publish mode. Defaults to 'upsert'. */
  mode?: 'upsert' | 'replace';
  /** Debounce publishes to this interval (ms). Defaults to 30000. */
  debounceMs?: number;
  /** Called with the response on success. */
  onPublish?: (result: unknown) => void;
  /** Called on publish failure. */
  onError?: (error: Error) => void;
  /** If true, renders an accessible status badge. Defaults to false (silent). */
  showStatus?: boolean;
}

export function CoalAgentPublisher({
  products,
  proxyUrl = '/api/coal/publish-catalog',
  mode = 'upsert',
  debounceMs = 30_000,
  onPublish,
  onError,
  showStatus = false,
}: CoalAgentPublisherProps): React.ReactElement | null {
  const lastPayloadRef = useRef<string>('');
  const lastPublishedAtRef = useRef<number>(0);
  const [status, setStatus] = useState<'idle' | 'publishing' | 'ok' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const payload = JSON.stringify({ products, mode });
    const now = Date.now();

    // Skip if nothing changed since the last publish.
    if (payload === lastPayloadRef.current) return;

    // Debounce: don't publish more than once per debounceMs.
    if (now - lastPublishedAtRef.current < debounceMs) return;

    lastPayloadRef.current = payload;
    lastPublishedAtRef.current = now;
    setStatus('publishing');
    setError(null);

    fetch(proxyUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(
            `Proxy returned ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
          );
        }
        return res.json();
      })
      .then((result) => {
        setStatus('ok');
        onPublish?.(result);
      })
      .catch((err: unknown) => {
        const e = err instanceof Error ? err : new Error(String(err));
        setStatus('error');
        setError(e.message);
        onError?.(e);
      });
  }, [products, proxyUrl, mode, debounceMs, onPublish, onError]);

  if (!showStatus) return null;

  const statusColor =
    status === 'ok'
      ? '#059669'
      : status === 'error'
        ? '#dc2626'
        : status === 'publishing'
          ? '#2563eb'
          : '#9ca3af';
  const label =
    status === 'ok'
      ? 'Catalog indexed on 0G'
      : status === 'error'
        ? error ?? 'Publish failed'
        : status === 'publishing'
          ? 'Publishing catalog…'
          : 'Catalog idle';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 14px',
        borderRadius: '999px',
        background: 'rgba(0,0,0,0.04)',
        fontSize: '12px',
        fontWeight: 600,
        color: statusColor,
      }}
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '999px',
          background: statusColor,
        }}
      />
      {label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CoalSchemaOrg — injects Schema.org JSON-LD Product markup
// ---------------------------------------------------------------------------
// ChatGPT and Perplexity cite pages that carry Schema.org Product/Offer data.
// Drop this component anywhere inside <CoalProvider> and it emits the correct
// JSON-LD <script> tag automatically from the merchant's profile.

export interface CoalSchemaOrgProps {
  /** Override the merchant ID. Defaults to the provider's merchantId. */
  merchantId?: string;
  /** Override the page URL. Defaults to window.location.href on the client. */
  url?: string;
}

export function CoalSchemaOrg({
  merchantId,
  url,
}: CoalSchemaOrgProps): React.ReactElement | null {
  const { profile } = useCoalMerchantProfile(merchantId);
  if (!profile || !profile.topProducts || profile.topProducts.length === 0) {
    return null;
  }

  const pageUrl =
    url ?? (typeof window !== 'undefined' ? window.location.href : undefined);
  const currency = profile.supportedTokens?.[0]?.symbol ?? 'USD';

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: profile.name ?? 'Coal Merchant Catalog',
    url: pageUrl,
    itemListElement: profile.topProducts.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: p.name,
        description: p.description ?? undefined,
        image: p.image ?? undefined,
        offers: {
          '@type': 'Offer',
          price: p.price,
          priceCurrency: currency,
          availability: 'https://schema.org/InStock',
          seller: {
            '@type': 'Organization',
            name: profile.name ?? 'Coal Merchant',
          },
        },
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      // React allows dangerouslySetInnerHTML for <script> JSON-LD blobs.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
    />
  );
}

// ---------------------------------------------------------------------------
// useCoalReceipt — hook that polls Coal for a receipt by session ID
// ---------------------------------------------------------------------------
// Useful for success pages: the merchant passes the session ID returned by
// the checkout, and this hook polls /api/receipts/{id} until all three steps
// of the proof trail are green or the timeout elapses.

export interface CoalReceipt {
  checkoutId: string;
  status: string;
  verified: boolean;
  payment?: {
    amount: string;
    currency: string;
    description?: string | null;
    txHash: string;
    explorerUrl: string;
    paidAt: string;
  };
  proofTrail?: {
    storage?: {
      storageUri: string;
      storageRoot: string;
      explorerUrl: string | null;
    } | null;
    chain?: {
      anchorTxHash: string;
      anchorContract: string;
      explorerUrl: string;
    } | null;
  } | null;
}

export interface UseCoalReceiptOptions {
  /** Poll interval in ms while any step is still pending. Default 2000. */
  pollIntervalMs?: number;
  /** Stop polling after this many ms even if the proof trail is incomplete. Default 60000. */
  timeoutMs?: number;
}

export interface UseCoalReceiptResult {
  receipt: CoalReceipt | null;
  loading: boolean;
  error: string | null;
  /** true when Base TX, 0G Storage, and 0G Chain are ALL present. */
  fullyVerified: boolean;
  /** Number of the 3 proof steps that are currently green. */
  verifiedSteps: number;
}

export function useCoalReceipt(
  sessionId: string | null | undefined,
  options: UseCoalReceiptOptions = {},
): UseCoalReceiptResult {
  const ctx = useCoalOptional();
  const apiUrl = ctx?.apiUrl ?? DEFAULT_COAL_API_URL;
  const pollIntervalMs = options.pollIntervalMs ?? 2000;
  const timeoutMs = options.timeoutMs ?? 60_000;

  const [receipt, setReceipt] = useState<CoalReceipt | null>(null);
  const [loading, setLoading] = useState<boolean>(!!sessionId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      setReceipt(null);
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();

    setLoading(true);
    setError(null);

    const poll = async (): Promise<void> => {
      if (cancelled) return;
      try {
        const res = await fetch(
          `${apiUrl}/api/receipts/${encodeURIComponent(sessionId)}`,
          { headers: { accept: 'application/json' } },
        );
        if (!res.ok) throw new Error(`Coal API returned ${res.status}`);
        const data = (await res.json()) as CoalReceipt;
        if (cancelled) return;
        setReceipt(data);

        const hasStorage = Boolean(data.proofTrail?.storage);
        const hasChain = Boolean(data.proofTrail?.chain);
        const done = data.verified && hasStorage && hasChain;

        if (done || Date.now() - startedAt > timeoutMs) {
          setLoading(false);
          return;
        }
        timer = setTimeout(poll, pollIntervalMs);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load receipt';
        setError(message);
        setLoading(false);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, apiUrl, pollIntervalMs, timeoutMs]);

  const verifiedSteps =
    (receipt?.verified ? 1 : 0) +
    (receipt?.proofTrail?.storage ? 1 : 0) +
    (receipt?.proofTrail?.chain ? 1 : 0);
  const fullyVerified = verifiedSteps === 3;

  return { receipt, loading, error, fullyVerified, verifiedSteps };
}

// ---------------------------------------------------------------------------
// Tiny shared UI primitives
// ---------------------------------------------------------------------------

function CoalLoading(): React.ReactElement {
  return (
    <div style={{ fontSize: '13px', color: '#71717a', padding: '16px' }}>Loading…</div>
  );
}

function CoalError({ message }: { message: string }): React.ReactElement {
  return (
    <div
      style={{
        fontSize: '13px',
        color: '#dc2626',
        padding: '16px',
        borderRadius: '12px',
        background: 'rgba(220,38,38,0.06)',
      }}
    >
      Coal error: {message}
    </div>
  );
}

function CoalEmpty({ label }: { label: string }): React.ReactElement {
  return (
    <div
      style={{
        fontSize: '13px',
        color: '#a1a1aa',
        padding: '16px',
        textAlign: 'center',
      }}
    >
      {label}
    </div>
  );
}

function CoalLogo(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" fill="#FF5C16" />
      <path d="M8 12a4 4 0 1 1 4 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Backwards-compat aliases (kept for coal-react <= v0.3 users)
// ---------------------------------------------------------------------------

/** @deprecated Use CoalCheckoutButton instead. */
export const CoalWidget = CoalCheckoutButton;
/** @deprecated Use CoalCheckoutButton instead. */
export const CoalCheckout = CoalCheckoutButton;
