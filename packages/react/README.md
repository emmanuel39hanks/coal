# coal-react

React component and hook for [Coal](https://usecoal.xyz) — non-custodial crypto payments on Base.

## Install

```bash
npm install coal-react
# or
yarn add coal-react
```

React 18+ is a peer dependency.

## Usage

### `<CoalWidget />`

Drop-in iframe checkout component:

```tsx
import { CoalWidget } from 'coal-react';

export function CheckoutPage({ sessionId }: { sessionId: string }) {
  return (
    <CoalWidget
      sessionId={sessionId}
      onSuccess={(data) => {
        console.log('Payment confirmed', data.txHash);
        // redirect or unlock content
      }}
      onCancel={() => console.log('User cancelled')}
    />
  );
}
```

### `useCoalCheckout`

Low-level hook for programmatic mount/unmount:

```tsx
import { useRef, useEffect } from 'react';
import { useCoalCheckout } from '@coal/react';

function PayButton({ sessionId }: { sessionId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { status, paymentData, mount, unmount } = useCoalCheckout({ sessionId });

  useEffect(() => {
    mount(containerRef);
    return () => unmount();
  }, [sessionId]);

  return (
    <div>
      <p>Status: {status}</p>
      <div ref={containerRef} />
    </div>
  );
}
```

## Props

### `CoalWidget`

| Prop | Type | Default | Description |
|---|---|---|---|
| `sessionId` | `string` | required | Session ID from `POST /api/checkouts` |
| `baseUrl` | `string` | `https://usecoal.xyz` | Coal frontend base URL |
| `height` | `number \| string` | `600` | iframe height |
| `theme` | `'light' \| 'dark'` | — | Color theme |
| `onReady` | `() => void` | — | Fired when iframe is ready |
| `onSuccess` | `(data) => void` | — | Fired on payment confirmation |
| `onError` | `(error) => void` | — | Fired on error |
| `onCancel` | `() => void` | — | Fired when user cancels |
| `className` | `string` | — | Wrapper div className |
| `style` | `CSSProperties` | — | Wrapper div inline style |

## Creating a session

Create a session server-side with your Coal API key:

```bash
curl -X POST https://api.usecoal.xyz/api/checkouts \
  -H "x-api-key: coal_live_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{ "amount": 49.99, "productName": "Pro Plan" }'
```

Returns `{ data: { id, url, status, expiresAt } }` — pass `id` as `sessionId`.

## License

MIT
