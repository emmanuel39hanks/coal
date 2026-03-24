import React, { useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CoalCheckoutButtonProps {
  /**
   * The checkout URL returned by your server's create-session call.
   * Preferred — pass this directly when available.
   */
  checkoutUrl?: string;
  /**
   * Alternative: pass sessionId + baseUrl and the URL will be constructed.
   * Ignored when checkoutUrl is provided.
   */
  sessionId?: string;
  /** Base URL for Coal. Defaults to 'https://usecoal.xyz'. */
  baseUrl?: string;
  /**
   * Where to open the checkout.
   * - '_self' (default): full-page redirect in the current tab.
   * - '_blank': open in a new tab.
   */
  target?: '_self' | '_blank';
  /** Called immediately before the redirect/open happens. Use for analytics. */
  onBeforeRedirect?: () => void;
  /** Button content. Defaults to a styled "Pay with Coal" label. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export interface UseCoalCheckoutOptions {
  /**
   * The checkout URL returned by your server's create-session call.
   * Preferred — pass this directly when available.
   */
  checkoutUrl?: string;
  /**
   * Alternative: pass sessionId + baseUrl and the URL will be constructed.
   * Ignored when checkoutUrl is provided.
   */
  sessionId?: string;
  /** Base URL for Coal. Defaults to 'https://usecoal.xyz'. */
  baseUrl?: string;
}

export interface UseCoalCheckoutReturn {
  /** The resolved checkout URL (null if neither checkoutUrl nor sessionId provided). */
  checkoutUrl: string | null;
  /** Full-page redirect in the current tab. */
  redirectToCheckout: () => void;
  /** Open checkout in a new tab. */
  openCheckout: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveUrl(opts: Pick<UseCoalCheckoutOptions, 'checkoutUrl' | 'sessionId' | 'baseUrl'>): string | null {
  if (opts.checkoutUrl) return opts.checkoutUrl;
  if (opts.sessionId) {
    const base = (opts.baseUrl ?? 'https://usecoal.xyz').replace(/\/$/, '');
    return `${base}/pay/checkout/${encodeURIComponent(opts.sessionId)}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// CoalCheckoutButton
// ---------------------------------------------------------------------------

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
  const url = resolveUrl({ checkoutUrl, sessionId, baseUrl });
  const [hovered, setHovered] = React.useState(false);

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

// ---------------------------------------------------------------------------
// useCoalCheckout hook
// ---------------------------------------------------------------------------

export function useCoalCheckout(options: UseCoalCheckoutOptions): UseCoalCheckoutReturn {
  const url = resolveUrl(options);

  const redirectToCheckout = useCallback(() => {
    if (!url) { console.error('[useCoalCheckout] No checkoutUrl or sessionId provided.'); return; }
    window.location.href = url;
  }, [url]);

  const openCheckout = useCallback(() => {
    if (!url) { console.error('[useCoalCheckout] No checkoutUrl or sessionId provided.'); return; }
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [url]);

  return { checkoutUrl: url, redirectToCheckout, openCheckout };
}

// ---------------------------------------------------------------------------
// Small inline Coal wordmark / icon for the default button label
// ---------------------------------------------------------------------------

function CoalLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" fill="#FF5C16" />
      <path d="M8 12a4 4 0 1 1 4 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Backwards-compat aliases
// ---------------------------------------------------------------------------

/** @deprecated Use CoalCheckoutButton instead. */
export const CoalWidget = CoalCheckoutButton;
/** @deprecated Use CoalCheckoutButton instead. */
export const CoalCheckout = CoalCheckoutButton;
