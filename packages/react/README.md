# coal-react

Payment rails for humans and AI agents on [0G](https://0g.ai). Drop-in React components, Next.js route helpers, and a server-side catalog indexing SDK.

[![npm version](https://img.shields.io/npm/v/coal-react)](https://www.npmjs.com/package/coal-react)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

```bash
npm install coal-react
```

## What coal-react does

| Surface | What it does | Import from |
|---|---|---|
| **Client components** | Checkout buttons, product grids, catalog publisher, Schema.org SEO | `coal-react` |
| **Server helper** | Publish your product catalog to Coal's 0G-backed index | `coal-react/server` |
| **Next.js routes** | Serve `/.well-known/agent-card.json`, `/llms.txt`, `/.well-known/x402.json` | `coal-react/next` |

One SDK. Your site becomes agent-discoverable with a verifiable proof trail on 0G for every transaction.

## Quick start

### 1. Wrap your app in CoalProvider

```tsx
// app/layout.tsx
import { CoalProvider } from 'coal-react';

export default function RootLayout({ children }) {
  return (
    <CoalProvider merchantId="your-coal-merchant-id">
      {children}
    </CoalProvider>
  );
}
```

### 2. Add a checkout button

```tsx
// app/products/page.tsx
import { CoalBuyButton } from 'coal-react';

export default function ProductPage() {
  return (
    <CoalBuyButton
      createSession={async () => {
        const res = await fetch('/api/create-checkout', { method: 'POST' });
        return res.json(); // { url: 'https://usecoal.xyz/pay/checkout/...' }
      }}
    >
      Buy for $9.99
    </CoalBuyButton>
  );
}
```

### 3. Make your site agent-discoverable (optional)

```ts
// app/.well-known/agent-card.json/route.ts
import { createAgentCardRoute } from 'coal-react/next';
export const GET = createAgentCardRoute({ merchantId: 'your-coal-merchant-id' });

// app/llms.txt/route.ts
import { createLlmsTxtRoute } from 'coal-react/next';
export const GET = createLlmsTxtRoute({ merchantId: 'your-coal-merchant-id' });
```

AI agents using A2A (Google), x402 (Coinbase), MCP, or LLM crawlers (ChatGPT, Perplexity) can now find your products.

## Client components

All components require `<CoalProvider>` as an ancestor.

### `<CoalProvider>`

Wraps your app with Coal configuration. Safe to render on the server.

```tsx
<CoalProvider
  merchantId="lst00PqE..."        // Your Coal merchant ID (required)
  apiUrl="https://api.usecoal.xyz" // Coal API URL (default)
  baseUrl="https://usecoal.xyz"    // Coal frontend URL (default)
>
  {children}
</CoalProvider>
```

### `<CoalCheckoutButton>`

Redirects to Coal's hosted checkout. Use when you already have a checkout URL or session ID.

```tsx
<CoalCheckoutButton
  checkoutUrl="https://usecoal.xyz/pay/checkout/abc123"
  target="_self"     // '_self' (redirect) or '_blank' (new tab)
  onBeforeRedirect={() => analytics.track('checkout_start')}
>
  Pay with Coal
</CoalCheckoutButton>
```

### `<CoalBuyButton>`

Higher-level button — calls your server to create a session, then redirects. API key stays server-side.

```tsx
<CoalBuyButton
  createSession={async () => {
    const res = await fetch('/api/checkout', { method: 'POST' });
    return res.json(); // must return { url } or { sessionId } or { id }
  }}
  onError={(err) => console.error(err)}
>
  Buy Now
</CoalBuyButton>
```

### `<CoalProducts>`

Product grid from your Coal merchant profile.

```tsx
<CoalProducts
  layout="grid"      // 'grid' or 'list'
  columns={3}
  renderProduct={(p) => <MyCustomCard product={p} />} // Optional
/>
```

### `<CoalProduct>`

Single product card by ID.

```tsx
<CoalProduct id="product-id-from-coal" />
```

### `<CoalAgentPublisher>`

Publishes your catalog to Coal for 0G-backed agent discovery. Posts to a merchant-owned proxy route (your server handles the API key).

```tsx
<CoalAgentPublisher
  products={[
    { externalId: 'sku-1', name: 'Pro Plan', price: 29.99, description: '...' },
    { externalId: 'sku-2', name: 'Enterprise', price: 99, image: 'https://...' },
  ]}
  proxyUrl="/api/coal/publish-catalog"  // Your proxy route (default)
  mode="upsert"                         // 'upsert' or 'replace'
  headers={{ 'x-csrf-token': token }}   // Custom auth headers
  showStatus                            // Shows "Indexed on 0G" badge
  onPublish={(result) => console.log(result)}
/>
```

### `<CoalSchemaOrg>`

Injects Schema.org JSON-LD Product/Offer markup so ChatGPT, Perplexity, and Google AI Overviews can cite your products. XSS-safe.

```tsx
<CoalSchemaOrg />
```

### `useCoalReceipt(sessionId)`

Polls Coal for a receipt until the 3-step proof trail is complete (Base TX → 0G Storage → 0G Chain).

```tsx
const { receipt, loading, fullyVerified, verifiedSteps } = useCoalReceipt(sessionId);
// fullyVerified = true when all 3 steps are green
// verifiedSteps = 0..3
```

## Server helper

### `publishCoalCatalog(options)`

**Import from `coal-react/server`.** Server-only — throws if imported in a browser.

```ts
import { publishCoalCatalog } from 'coal-react/server';

const result = await publishCoalCatalog({
  merchantId: 'your-merchant-id',
  apiKey: process.env.COAL_API_KEY!,
  products: [
    { externalId: 'sku-1', name: 'Pro Plan', price: 29.99 },
    { externalId: 'sku-2', name: 'Enterprise', price: 99 },
  ],
  mode: 'upsert',  // or 'replace'
});

console.log(result.zeroG.storageUri); // "0g://log/0x..."
```

**What happens:** Coal upserts products → publishes to 0G Storage (immutable) → mirrors to 0G KV (live discovery) → agents find your products.

### Example proxy route

```ts
// app/api/coal/publish-catalog/route.ts
import { publishCoalCatalog } from 'coal-react/server';

export async function POST(request: Request) {
  // Add your own auth here!
  const body = await request.json();
  const result = await publishCoalCatalog({
    merchantId: process.env.NEXT_PUBLIC_COAL_MERCHANT_ID!,
    apiKey: process.env.COAL_API_KEY!,
    products: body.products,
  });
  return Response.json(result);
}
```

## Next.js route helpers

**Import from `coal-react/next`.** Drop-in GET handlers for agent-discoverable manifests.

### `createAgentCardRoute(options)`

Serves [A2A Agent Card](https://a2a-protocol.org/) at `/.well-known/agent-card.json`.

```ts
// app/.well-known/agent-card.json/route.ts
import { createAgentCardRoute } from 'coal-react/next';
export const GET = createAgentCardRoute({ merchantId: '...' });
```

### `createLlmsTxtRoute(options)`

Serves `/llms.txt` for ChatGPT, Perplexity, Google AI Overviews.

```ts
// app/llms.txt/route.ts
import { createLlmsTxtRoute } from 'coal-react/next';
export const GET = createLlmsTxtRoute({ merchantId: '...' });
```

### `createX402ManifestRoute(options)`

Serves `/.well-known/x402.json` for [x402 Bazaar](https://docs.cdp.coinbase.com/x402/bazaar) (Coinbase).

```ts
// app/.well-known/x402.json/route.ts
import { createX402ManifestRoute } from 'coal-react/next';
export const GET = createX402ManifestRoute({ merchantId: '...' });
```

## How it fits together

```
Your Next.js app                          Coal                           0G Network
─────────────────                         ────                           ──────────
<CoalProvider>                      →     Merchant profile API     →    0G Storage (Log)
<CoalAgentPublisher products={}>    →     POST /publish-catalog    →    0G KV mirror
<CoalBuyButton createSession={}>    →     POST /checkouts          →    Base (USDC)
<CoalSchemaOrg />                   →     (renders locally)        →    ChatGPT/Perplexity
useCoalReceipt(id)                  →     GET /receipts/{id}       →    3-step proof trail
createAgentCardRoute()              →     GET /merchant-profiles   →    A2A Agent Card
createLlmsTxtRoute()                →     GET /merchant-profiles   →    llms.txt
createX402ManifestRoute()           →     GET /merchant-profiles   →    x402 Bazaar
```

## Examples

- **[demo-store](https://coal-demo-store.vercel.app)** — Full storefront with catalog indexing + agent manifests ([source](https://github.com/emmanuel39hanks/coal/tree/main/examples/demo-store))
- **[coal-react-checkout](https://coal-react-checkout.vercel.app)** — Every Coal feature demoed ([source](https://github.com/emmanuel39hanks/coal/tree/main/examples/coal-react-checkout))
- **[coal-agent](https://coal-agent.vercel.app)** — AI agent sandbox with autonomous purchases

## Requirements

- React 18+ (peer dependency, optional for server-only usage)
- Next.js 14+ for `/next` route helpers
- [Coal merchant account](https://usecoal.xyz) + API key for `publishCoalCatalog()`

## Links

- [Coal Platform](https://usecoal.xyz) | [API Docs](https://api.usecoal.xyz/api/docs/ui) | [0G Setup Guide](https://github.com/emmanuel39hanks/coal/blob/main/0G-SETUP.md) | [GitHub](https://github.com/emmanuel39hanks/coal)

## License

MIT — [Schema Labs](https://github.com/emmanuel39hanks/coal)
