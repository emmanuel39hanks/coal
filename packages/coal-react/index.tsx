import { useEffect, useRef } from 'react';

interface CoalCheckoutProps {
  apiKey: string;
  amount: number;
  currency?: string;
  description?: string;
  onSuccess?: (result: { txHash?: string; sessionId: string }) => void;
  onClose?: () => void;
  onError?: (error: string) => void;
}

export function CoalCheckout(props: CoalCheckoutProps) {
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;

    if (typeof window === 'undefined') return;

    const widget = (window as any).CoalCheckout || (window as any).Coal;
    if (widget) {
      if (typeof widget.checkout === 'function') {
        widget.checkout(props);
      } else {
        console.warn('[CoalCheckout] Expected a compatibility widget with checkout().');
      }
    }
  }, []);

  return null; // Widget is rendered as overlay, not inline
}
