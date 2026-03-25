# coal-react-checkout-example

A fully working Next.js checkout page built with [`@coal/react`](https://www.npmjs.com/package/@coal/react).

## What it does

1. Shows a product selection page (3 plans)
2. On "Pay with crypto", calls your backend to create a Coal checkout session
3. Renders the `<CoalWidget />` iframe from `@coal/react`
4. Handles `onSuccess`, `onCancel`, and `onError` events
5. Shows a confirmation screen with a Basescan link on payment

## Setup

```bash
cp .env.example .env.local
# Fill in COAL_API_KEY with your key from https://usecoal.xyz/console

npm install
npm run dev
# Open http://localhost:3002
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `COAL_API_KEY` | ✅ | Your Coal API key (`coal_live_...`) |
| `COAL_API_URL` | — | Defaults to `https://api.usecoal.xyz` |
| `NEXT_PUBLIC_COAL_BASE_URL` | — | Defaults to `https://www.usecoal.xyz` |

## How the `@coal/react` integration works

```tsx
import { CoalWidget } from '@coal/react';

// 1. Create a session server-side (see app/api/create-session/route.ts)
const { sessionId } = await fetch('/api/create-session', {
  method: 'POST',
  body: JSON.stringify({ amount: 29.99, productName: 'Pro Plan' }),
}).then(r => r.json());

// 2. Render the widget — that's it
<CoalWidget
  sessionId={sessionId}
  onSuccess={(data) => console.log('paid', data.txHash)}
  onCancel={() => setStep('select')}
/>
```

## File structure

```
app/
  layout.tsx               # Root layout
  page.tsx                 # Product selection + checkout flow
  api/
    create-session/
      route.ts             # Server route: calls Coal API to create session
```
