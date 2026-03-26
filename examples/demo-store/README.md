# Coal Demo Store

A storefront example showing how to integrate Coal payments into a Next.js e-commerce app. Creates checkout sessions via server actions and handles payment webhooks.

## What it does

1. Displays a product grid (6 items) with images and prices
2. "Buy with Coal" triggers a server action that creates a Coal checkout session
3. Redirects the customer to the hosted Coal checkout page
4. Receives a webhook on payment confirmation
5. Redirects to a success page after payment

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
| `COAL_API_KEY` | Yes | Your Coal API key (`coal_live_...`) |
| `COAL_API_URL` | No | Defaults to `http://localhost:3001/api/checkouts` |
| `NEXT_PUBLIC_APP_URL` | No | Defaults to `http://localhost:3002` |

## How it works

### Server action (`app/actions.ts`)

```typescript
const response = await fetch(COAL_API_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  },
  body: JSON.stringify({
    amount: 0.02,
    currency: 'MNEE',
    productId: 'prod_coffee',
    productName: 'Super Coffee',
    redirectUrl: `${APP_URL}/success`,
    callbackUrl: `${APP_URL}/api/webhook`,
  }),
});
```

### Receipt verification

After payment confirmation, verify the receipt and its 0G proof trail:

```typescript
const receipt = await fetch(`https://api.usecoal.xyz/api/receipts/${sessionId}`);
const { proofTrail } = await receipt.json();
// proofTrail.storage → 0G Storage proof (immutable receipt)
// proofTrail.chain   → 0G Chain anchor (tamper-proof verification)
```

## File structure

```
app/
  layout.tsx          # Root layout
  page.tsx            # Product grid with checkout forms
  actions.ts          # Server action: creates Coal checkout session
  success/
    page.tsx          # Post-payment success page
  api/
    webhook/
      route.ts        # Webhook handler for payment events
```
