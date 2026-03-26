# Coal

> **0G APAC Hackathon 2026 — Track 3: Agentic Economy**
>
> Payment infrastructure for the AI agent economy, built on 0G.
> Live at [usecoal.xyz](https://usecoal.xyz) | API at [api.usecoal.xyz](https://api.usecoal.xyz)

**Coal by Schema Labs is a programmable commerce platform for hosted checkout, merchant APIs, payment links, paywalls, recurring billing, and agentic commerce flows.**

Coal is built around a simple split:

- `Coal` handles checkout orchestration, merchant operations, payer-info capture, recurring billing, and settlement flows on Base.
- `0G` adds the sidecar layer for artifact storage, receipt proof anchoring, merchant memory, and AI commerce endpoints.

This repo is an active product branch, not a tiny demo. The current codebase includes:

- hosted checkout and payment links
- merchant dashboard and onboarding
- payer-info collection at checkout
- recurring billing foundations
- widget/embed and SDK surfaces
- docs site + OpenAPI playground
- live 0G storage / chain / compute integration

## 0G Integration — 4 Components

Coal uses **four** 0G network components on mainnet:

### 1. 0G Storage — Immutable Artifact Layer
Every payment receipt, merchant profile, and encrypted memory snapshot is published to 0G Storage as an immutable artifact. AI agents and apps can discover merchants and verify payments by reading these artifacts directly from the decentralized storage network.

- **Receipt payloads:** tx hash, amount, payer address, merchant, metadata
- **Merchant profiles:** name, products, paywalls, supported tokens, API endpoints
- **Encrypted memory:** AES-256-GCM encrypted full catalog + settings (only Coal can decrypt)
- Explorer: [storagescan.0g.ai](https://storagescan.0g.ai)

### 2. 0G Chain — Receipt Proof Anchoring
After publishing a receipt to 0G Storage, Coal anchors a SHA-256 hash of the receipt payload on-chain via the `CoalReceiptAnchor` smart contract. This creates a tamper-proof, independently verifiable proof that a specific payment happened at a specific time.

- Contract: `CoalReceiptAnchor` on 0G Chain (chain ID 16661)
- Explorer: [chainscan.0g.ai](https://chainscan.0g.ai)

### 3. 0G Compute — AI Commerce Inference
Coal's agent-facing APIs use 0G Compute for AI inference:

- **Memory query:** Natural language Q&A against merchant data ("What products does this merchant sell?")
- **Commerce routing:** AI decides which merchant or product fits an agent's request
- **Policy evaluation:** AI evaluates scenarios against merchant rules ("Can this customer get a refund?")
- **Sealed inference:** Privacy-preserving inference where the model never sees raw merchant data

### 4. 0G DA — Data Availability (Feature-Flagged)
Coal has a complete DA integration (282 lines, gRPC client, 6 event types, TLS, health checks) that posts payment lifecycle events as DA blobs. Currently feature-flagged (`ZERO_G_DA_ENABLED=false`) pending public DA endpoint availability.

- Event types: payment_confirmed, refund_issued, subscription_created, subscription_renewed, subscription_cancelled, merchant_updated

### Architecture

![Coal Architecture](plans/assets/architecture.svg)

## What Is Live

### Merchant product surface

- Products, payment links, paywalls, API keys, team management, analytics, settings
- Console auth through Privy
- Async on-chain verification and webhook delivery
- Hosted renewal checkouts for recurring billing

### Checkout surface

- Public checkout pages under `/pay/[slug]` and `/pay/checkout/[id]`
- Payer-info configuration and validation
- Direct settlement-token payments on Base
- Widget/embed flow using the real checkout lifecycle

### Agentic / 0G surface

- Merchant profile publication to 0G Storage
- Merchant memory snapshots with encrypted storage payloads
- Verifiable receipt publication + 0G chain anchoring
- Agent-facing paywall manifests and verification routes
- AI commerce APIs backed by 0G Compute
- Console operator page at `/console/0g`

## Project Stats

| Metric | Value |
|--------|-------|
| Test suite | 495 tests across 32 files |
| 0G components | 4 (Storage, Chain, Compute, DA) |
| Network | Base mainnet (USDC) + 0G mainnet |
| Live deployment | [usecoal.xyz](https://usecoal.xyz) |
| API | [api.usecoal.xyz](https://api.usecoal.xyz) |

## Quick Start for Judges

1. **Try the live app:** Visit [usecoal.xyz](https://usecoal.xyz), sign in with Privy, explore the merchant console
2. **See 0G integration:** Go to Console → 0G to see all 4 components with live mainnet status
3. **Verify a receipt:** Visit `/verify/[session-id]` to see the full 0G proof trail for any payment
4. **Run the example:** Clone the repo, `cd examples/coal-react-checkout`, `cp .env.example .env.local`, fill in your API key, `npm install && npm run dev`
5. **Read the agent code:** See `examples/agentkit-action/coal-checkout-action.ts` for a complete AgentKit action provider with 7 actions

## Core Thesis

Coal is not being replaced by 0G.

- `Coal` is the payment execution and merchant operations layer.
- `0G` is the storage, proof, memory, and AI layer around it.

That is the correct mental model for the repo.

## Repo Layout

```text
coal/
├── backend/      # Next.js API app, Prisma, on-chain verification, 0G logic
├── frontend/     # Next.js UI app, docs site, dashboard, checkout surfaces
├── contracts/    # 0G receipt anchor contract package
├── packages/     # JS + React SDK surfaces
├── examples/     # Example integrations: React checkout, AgentKit, demo-store
├── 0g/           # 0G architecture + rollout planning docs
├── context/      # Current-state handoff docs for future agents/contributors
├── bugs/         # Original bug audit
├── bugs-2/       # Follow-up verification and bug audit
└── security/     # Security review notes and hardening queue
```

## System Architecture

```mermaid
flowchart LR
    A["Merchant / App / Agent"] --> B["Coal Frontend"]
    B --> C["Coal Backend"]
    C --> D["Base RPC via Alchemy"]
    C --> E["Postgres via Neon"]
    C --> F["Webhook Delivery"]
    C --> G["0G Storage"]
    C --> H["0G Chain"]
    C --> I["0G Compute"]
```

See [plans/assets/architecture.svg](plans/assets/architecture.svg) for the full architecture diagram.

Two separate Next.js apps are deployed from the same repo:

- [backend](/Users/emmanuel/Documents/schemalabs/coal/backend) runs the API, verification jobs, agent routes, and 0G services
- [frontend](/Users/emmanuel/Documents/schemalabs/coal/frontend) runs the dashboard, docs, checkout UI, and public pages

## Examples

The repo also includes runnable integration examples under [examples](/Users/emmanuel/Documents/schemalabs/coal/examples):

- [coal-react-checkout](/Users/emmanuel/Documents/schemalabs/coal/examples/coal-react-checkout)
  A full Next.js checkout demo built on `@coal/react`, including hosted checkout launch, success handling, receipt verification, and an agent-style simulation flow.
- [agentkit-action](/Users/emmanuel/Documents/schemalabs/coal/examples/agentkit-action)
  A Coal action provider for AgentKit with checkout, receipt verification, paywall, merchant-memory, and policy-evaluation actions.
- [demo-store](/Users/emmanuel/Documents/schemalabs/coal/examples/demo-store)
  A storefront-style example that creates Coal sessions, receives webhooks, and now verifies receipts against the 0G proof trail.

If you want the quickest demo path, start with [coal-react-checkout](/Users/emmanuel/Documents/schemalabs/coal/examples/coal-react-checkout) and [examples/coal-react-checkout/README.md](/Users/emmanuel/Documents/schemalabs/coal/examples/coal-react-checkout/README.md).

## Key Surfaces

### Merchant-facing

- [Console dashboard](/Users/emmanuel/Documents/schemalabs/coal/frontend/app/console/page.tsx)
- [Products](/Users/emmanuel/Documents/schemalabs/coal/frontend/app/console/products/page.tsx)
- [Payment links](/Users/emmanuel/Documents/schemalabs/coal/frontend/app/console/payment-links/page.tsx)
- [Subscriptions](/Users/emmanuel/Documents/schemalabs/coal/frontend/app/console/subscriptions/page.tsx)
- [0G operator page](/Users/emmanuel/Documents/schemalabs/coal/frontend/app/console/0g/page.tsx)

### Public checkout

- [Slug checkout](/Users/emmanuel/Documents/schemalabs/coal/frontend/app/pay/[slug]/page.tsx)
- [Direct checkout session page](/Users/emmanuel/Documents/schemalabs/coal/frontend/app/pay/checkout/[id]/page.tsx)
- [Payment view component](/Users/emmanuel/Documents/schemalabs/coal/frontend/components/PaymentView.tsx)

### APIs

- [Merchant API checkouts](/Users/emmanuel/Documents/schemalabs/coal/backend/app/api/checkouts/route.ts)
- [Pay session](/Users/emmanuel/Documents/schemalabs/coal/backend/app/api/pay/session/route.ts)
- [Pay confirm](/Users/emmanuel/Documents/schemalabs/coal/backend/app/api/pay/confirm/route.ts)
- [Verify payments cron](/Users/emmanuel/Documents/schemalabs/coal/backend/app/api/cron/verify-payments/route.ts)
- [0G health](/Users/emmanuel/Documents/schemalabs/coal/backend/app/api/0g/health/route.ts)
- [Console 0G status](/Users/emmanuel/Documents/schemalabs/coal/backend/app/api/console/0g/route.ts)

### Agent / 0G routes

- [Merchant profiles](/Users/emmanuel/Documents/schemalabs/coal/backend/app/api/agent/merchant-profiles/[merchantId]/route.ts)
- [Memory ingest](/Users/emmanuel/Documents/schemalabs/coal/backend/app/api/agent/memory/ingest/route.ts)
- [Memory query](/Users/emmanuel/Documents/schemalabs/coal/backend/app/api/agent/memory/query/route.ts)
- [Commerce route](/Users/emmanuel/Documents/schemalabs/coal/backend/app/api/agent/commerce/route/route.ts)
- [Support answer](/Users/emmanuel/Documents/schemalabs/coal/backend/app/api/agent/commerce/support-answer/route.ts)
- [Policy evaluation](/Users/emmanuel/Documents/schemalabs/coal/backend/app/api/agent/commerce/policy-eval/route.ts)
- [Recommendations](/Users/emmanuel/Documents/schemalabs/coal/backend/app/api/agent/commerce/recommend/route.ts)

## Authentication Model

Coal has two auth surfaces:

- Merchant API requests use `x-api-key` with `coal_live_*` keys
- Dashboard and `/api/console/*` routes use Privy Bearer JWTs

Legacy Better Auth has been retired from runtime use.

## Settlement Model

Coal settles to the configured Base settlement token.

- `USDC` is the fallback default
- older `MNEE_*` environment aliases remain only as compatibility helpers
- the product is no longer MNEE-first

## Local Development

### Prerequisites

- Node.js `24+`
- npm
- Neon or another Postgres database
- Alchemy API key for Base
- Privy app credentials

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 2. Configure environment files

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Then fill in the required values in:

- [backend/.env.example](/Users/emmanuel/Documents/schemalabs/coal/backend/.env.example)
- [frontend/.env.example](/Users/emmanuel/Documents/schemalabs/coal/frontend/.env.example)

Important backend values:

- `DATABASE_URL`
- `ALCHEMY_API_KEY`
- `PRIVY_APP_ID`
- `PRIVY_APP_SECRET`
- `NEXT_PUBLIC_FRONTEND_URL`
- `NEXT_PUBLIC_API_URL`
- `CRON_SECRET`

Important frontend values:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_PRIVY_APP_ID`
- `NEXT_PUBLIC_CHAIN_ENV`
- `NEXT_PUBLIC_COINBASE_BUNDLER_KEY`

### 3. Prepare the database

```bash
cd backend
npx prisma db push
```

### 4. Run both apps

Open two terminals:

```bash
# Terminal 1
cd backend
npm run dev
```

```bash
# Terminal 2
cd frontend
npm run dev
```

Default local URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`

## Verification Commands

### Backend

```bash
cd backend
npm run typecheck
npm test
npm run build
```

### Frontend

```bash
cd frontend
npm run typecheck
npm run build
```

### 0G storage benchmark

```bash
cd backend
npm run 0g:storage:benchmark
```

## 0G Notes

0G is opt-in. Coal still works without it.

Set these only when you are ready to turn the live 0G layer on:

- `ZERO_G_ENABLED=true`
- `ZERO_G_CHAIN_RPC_URL`
- `ZERO_G_CHAIN_PRIVATE_KEY`
- `ZERO_G_RECEIPT_ANCHOR_ADDRESS`
- `ZERO_G_STORAGE_INDEXER_URL`
- `ZERO_G_STORAGE_ENCRYPTION_KEY`
- `ZERO_G_COMPUTE_ENABLED=true`
- `ZERO_G_COMPUTE_PROVIDER`
- `ZERO_G_COMPUTE_BASE_URL`
- `ZERO_G_COMPUTE_API_KEY`
- `ZERO_G_COMPUTE_MODEL`

The main implementation lives in:

- [backend/lib/0g/storage.ts](/Users/emmanuel/Documents/schemalabs/coal/backend/lib/0g/storage.ts)
- [backend/lib/0g/chain.ts](/Users/emmanuel/Documents/schemalabs/coal/backend/lib/0g/chain.ts)
- [backend/lib/0g/compute.ts](/Users/emmanuel/Documents/schemalabs/coal/backend/lib/0g/compute.ts)
- [backend/lib/0g/merchant.ts](/Users/emmanuel/Documents/schemalabs/coal/backend/lib/0g/merchant.ts)
- [backend/lib/receipts/proof.ts](/Users/emmanuel/Documents/schemalabs/coal/backend/lib/receipts/proof.ts)

## SDK / Widget

Canonical package surfaces:

- JS widget/runtime: [packages/coal-js/coal.js](/Users/emmanuel/Documents/schemalabs/coal/packages/coal-js/coal.js)
- React package: [packages/react](/Users/emmanuel/Documents/schemalabs/coal/packages/react)
- Public widget asset: [frontend/public/coal-widget.js](/Users/emmanuel/Documents/schemalabs/coal/frontend/public/coal-widget.js)

## Docs

Coal ships a docs site and a live docs playground:

- Docs: `http://localhost:3000/docs`
- Playground: `http://localhost:3001/api/docs/ui`

Key files:

- [frontend/app/docs](/Users/emmanuel/Documents/schemalabs/coal/frontend/app/docs)
- [backend/app/api/docs/route.ts](/Users/emmanuel/Documents/schemalabs/coal/backend/app/api/docs/route.ts)
- [backend/app/api/docs/ui/route.ts](/Users/emmanuel/Documents/schemalabs/coal/backend/app/api/docs/ui/route.ts)

## Deployment

Coal deploys as two Vercel projects from the same repo:

- backend root directory: `backend`
- frontend root directory: `frontend`

Use [DEPLOYMENT.md](/Users/emmanuel/Documents/schemalabs/coal/DEPLOYMENT.md) for the full production checklist.

## Branch Strategy

- `main` is production and should point at Base mainnet + 0G mainnet.
- `dev` is the working branch and should point at Base Sepolia + 0G mainnet.
- Vercel production envs belong to `main`.
- Vercel preview envs for the `dev` branch should be synced with [scripts/sync-vercel-dev-env.sh](/Users/emmanuel/Documents/schemalabs/coal/scripts/sync-vercel-dev-env.sh).

Useful scripts:

- [scripts/check-all.sh](/Users/emmanuel/Documents/schemalabs/coal/scripts/check-all.sh) runs the full backend + frontend verification sweep.
- [scripts/push-dev.sh](/Users/emmanuel/Documents/schemalabs/coal/scripts/push-dev.sh) checks and pushes `dev`.
- [scripts/promote-dev-to-main.sh](/Users/emmanuel/Documents/schemalabs/coal/scripts/promote-dev-to-main.sh) fast-forwards `main` from `dev` after checks pass.
- [scripts/sync-vercel-dev-env.sh](/Users/emmanuel/Documents/schemalabs/coal/scripts/sync-vercel-dev-env.sh) syncs branch-specific Vercel preview env vars for `dev`.
