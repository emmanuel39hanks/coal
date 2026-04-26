# Coal Mini App

Coal packaged as a World App Mini App. Browse merchants, pay USDC on World Chain in one tap, verify with World ID.

Built with Next.js 15 + `@worldcoin/minikit-js`. Talks to the existing Coal backend (`api.usecoal.xyz` or local `http://localhost:3001`) — no DB or merchant API key needed on the client side because all browsing and session creation go through Coal's public `/api/resolve/link` and `/api/pay/session` endpoints.

---

## What's here

```
app/
  layout.tsx               MiniKitProvider wrapper + viewport lock
  page.tsx                 Shop tab — product grid + wallet auth
  shop/[slug]/page.tsx     Product detail + pay button
  success/[id]/page.tsx    Post-payment status + receipt
  profile/page.tsx         Me tab — wallet, World ID status, $50 cap
  api/nonce/route.ts       SIWE nonce mint
  api/siwe/verify/route.ts SIWE signature verification
components/
  Providers.tsx            MiniKit.install() + status context
  TabBar.tsx               Mobile bottom nav (Shop / Me)
  WalletAuth.tsx           MiniKit.commandsAsync.walletAuth()
  WorldIdVerify.tsx        MiniKit.commandsAsync.verify() (Device level)
  PayButton.tsx            MiniKit.commandsAsync.pay() — USDC on World Chain
  ProductCard.tsx          Product grid cell
lib/
  coal-api.ts              Public Coal backend client (no API key required)
  nonces.ts                In-memory nonce store (dev only)
```

---

## Setup

### 1. Install

```bash
cd examples/coal-mini-app
npm install --legacy-peer-deps
```

### 2. Environment

`.env.local` was created for you with a randomized `SIWE_SESSION_SECRET`. Fill in the rest:

```bash
# examples/coal-mini-app/.env.local
NEXT_PUBLIC_WORLD_APP_ID=app_staging_…      # from developer.worldcoin.org
NEXT_PUBLIC_WORLD_ACTION=verify_coal_user    # incognito action name from the portal
NEXT_PUBLIC_COAL_API_URL=http://localhost:3001
NEXT_PUBLIC_DEMO_LINK_SLUGS=slug-1,slug-2    # curated product slugs from your Coal console
```

You need a Worldcoin Developer Portal account:
1. Go to https://developer.worldcoin.org
2. **Create a new app** — pick "Mini App" type, set the staging URL to `http://localhost:3005` for now (we'll swap to ngrok for phone testing).
3. **Create an Incognito Action** called `verify_coal_user` with "Max verifications per user" = 1.
4. Copy the **App ID** (`app_staging_…` for staging, `app_…` for production) into `NEXT_PUBLIC_WORLD_APP_ID`.

### 3. Demo products

This Mini App browses Coal products via payment-link slugs. Create a few payment links in your Coal console and list their slugs in `NEXT_PUBLIC_DEMO_LINK_SLUGS` (comma-separated).

Easiest path: open `http://localhost:3000/console/payment-links`, create two or three links for existing products, copy the slugs.

### 4. Start the backend (in another terminal)

The Mini App depends on Coal's backend. Start it first:

```bash
cd ../../backend
npm run dev   # :3001
```

### 5. Start the Mini App

```bash
cd examples/coal-mini-app
npm run dev   # :3005
```

Open `http://localhost:3005` in a desktop browser first — the Shop page should render and show the configured products. Buttons that need World App (`Connect wallet`, `Pay`) will show a friendly error outside the webview.

---

## Test it inside World App

Mini Apps can only really be tested on a real phone inside World App. Workflow:

### 1. Tunnel your local port with ngrok

```bash
# in a fresh terminal
ngrok http 3005
```

Copy the HTTPS URL (e.g. `https://abc-123.ngrok-free.app`).

### 2. Update the Developer Portal

In https://developer.worldcoin.org → your app → **App URL**: paste the ngrok URL. Save.

### 3. Preview on your phone

In the portal, click **Preview**. Scan the QR code with your phone's camera. It deep-links into World App which then opens the Mini App inside its webview.

- Tap **Connect World wallet** — a sheet asks you to sign in with your World wallet via SIWE.
- Tap a product → **Pay X USDC** — World App prompts for confirmation, then submits the payment on World Chain.
- You're redirected to `/success/[sessionId]` which polls the backend until confirmation, then shows the receipt + Worldscan link.

### 4. World ID verify (Me tab)

Tap the Me tab → **Verify with World ID** → World App shows the Device Verify flow. On success we store the nullifier hash locally and flip the spending cap badge to `$50`.

> Server-side verification of the World ID proof (against the Worldcoin API) requires `WORLD_API_KEY`. This Mini App currently trusts the client-returned nullifier — fine for demo, needs a backend route before production.

---

## How it fits the Coal stack

- Product browse → `GET /api/resolve/link?slug=…` (public, no auth)
- Payment session → `POST /api/pay/session` with `{ linkId, chain: "worldchain" }` (public)
- Pay → `MiniKit.commandsAsync.pay()` — World App handles the USDC transfer on World Chain
- Confirm → `POST /api/pay/confirm` with the `transaction_id` from MiniKit
- Receipt → `GET /api/receipts/[sessionId]` returns the 4-step proof trail
  1. Payment tx on **World Chain** (Worldscan)
  2. Receipt artifact on **0G Storage**
  3. Anchor tx on **0G Chain** (canonical proof)
  4. Anchor tx on **World Chain** (settlement-chain proof)

The backend pieces (`settlementChain` column, World Chain anchor contract, chain-aware receipt builder) were added in the `world-chain-integration` branch — this Mini App plugs into them without any new backend code.

---

## Deploy

```bash
vercel --prod
```

Suggested custom domain: `world.usecoal.xyz`. Update `NEXT_PUBLIC_COAL_API_URL` to `https://api.usecoal.xyz` and the Developer Portal's **App URL** to your production domain.

---

## Known limitations

- **In-memory nonce store** (`lib/nonces.ts`) — single-process only. Move to Upstash Redis before multi-instance deploys.
- **Client-trusted World ID proof** — the Mini App currently doesn't verify the proof server-side. Add a `/api/worldid/verify` route that calls `https://developer.worldcoin.org/api/v2/verify/{APP_ID}` with `WORLD_API_KEY` before trusting the nullifier in any write path (e.g. spending-cap enforcement).
- **Transaction ID vs real tx hash** — MiniKit's `pay` command returns a `transaction_id` (World App's internal id). The backend's `verify-payments` cron expects a real on-chain tx hash. If the two diverge in practice, wire up `MiniKit.getTransactionStatus(transaction_id)` to resolve the real hash before calling `/api/pay/confirm`.
- **Outside World App** — all MiniKit calls no-op. Guard with `MiniKit.isInstalled()` (already done in every component).
