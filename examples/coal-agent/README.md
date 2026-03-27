# Coal Agent — AI Commerce on 0G

Full-blown AI agent chat app demonstrating **Coal payments** integrated with all four **0G network components**: Storage, Chain, Compute, and Sealed Inference.

Built for the [0G APAC Hackathon](https://dorahacks.io/hackathon/0g-apac/detail) — Track 3: DeFi & Payments.

## Quick Start

```bash
cp .env.example .env
# Fill in OPENAI_API_KEY and COAL_API_KEY

npm install
npm run dev
# Open http://localhost:3003
```

## Architecture

```
User ←→ Chat UI (Next.js) ←→ /api/chat (SSE streaming)
                                   ↓
                            OpenAI GPT-4o (function calling)
                                   ↓
                          ┌────────┴────────┐
                          │  Tool Executor   │
                          └────────┬────────┘
                    ┌──────┬──────┼──────┬──────┐
                    ▼      ▼      ▼      ▼      ▼
               0G Storage  Coal API  0G Compute  0G Chain
               (direct SDK) (REST)  (inference)  (anchoring)
```

## 10 Agent Tools

| Tool | What it does | 0G Component |
|------|-------------|--------------|
| `discover_merchant_on_0g` | Downloads merchant profile directly from 0G Storage nodes | **Storage** |
| `get_merchant_profile` | Fetches profile via Coal API | Storage |
| `query_merchant_memory` | Queries encrypted merchant memory | **Compute + Sealed Inference** |
| `route_commerce_request` | AI-routes commerce intent to best surface | Compute + Storage |
| `get_recommendations` | Gets product recommendations | Compute |
| `evaluate_policy` | Evaluates refund/dispute policies in TEE | **Sealed Inference** |
| `check_paywall` | Checks paywall access status | Storage |
| `create_checkout` | Creates a payment checkout session | — |
| `create_paywall_pay_intent` | Creates x402 payment intent | Storage |
| `verify_receipt` | Verifies receipt with full 0G proof trail | **Storage + Chain** |

## 0G Components in Action

| Component | How Coal Uses It |
|-----------|-----------------|
| **0G Storage** | Merchant profiles, payment receipts, and encrypted memory snapshots stored immutably across 4 decentralized nodes |
| **0G Chain** | Receipt SHA-256 hashes anchored on-chain (chain ID 16661) via CoalReceiptAnchor contract for tamper-proof verification |
| **0G Compute** | AI inference for memory queries, commerce routing, and product recommendations |
| **0G Sealed Inference** | TEE-backed privacy-preserving inference — AI model evaluates policies without seeing raw merchant data |

## Demo Script for Judges

1. Click **"Discover merchant on 0G"** — agent downloads real data from 0G Storage mainnet, shows download metrics and parsed profile
2. Click **"Query merchant memory"** — agent queries encrypted memory via 0G Compute, shows answer with citations
3. Click **"Evaluate a refund policy"** — agent uses Sealed Inference (TEE) for privacy-preserving policy evaluation
4. Click **"Verify a payment receipt"** — agent shows the 3-step proof trail: Base TX → 0G Storage → 0G Chain
5. Click **"Full commerce flow"** — agent chains all tools autonomously: discover → query → checkout → verify

## File Structure

```
app/
  layout.tsx              # Dark theme layout
  page.tsx                # Chat UI with SSE streaming
  globals.css             # Tailwind v4 dark theme
  api/chat/route.ts       # OpenAI streaming + function calling loop
components/
  ChatMessage.tsx          # User/assistant/tool message rendering
  ToolResultCard.tsx       # Dispatcher → specific card by tool name
  cards/
    ZeroGDownloadCard.tsx  # 0G Storage download with metrics
    MerchantProfileCard.tsx # Profile, products, capabilities
    ReceiptCard.tsx        # 3-step proof trail visualization
    MemoryQueryCard.tsx    # Answer + Sealed Inference badge
    PolicyEvalCard.tsx     # Allow/deny/review decision
    CommerceRouteCard.tsx  # Commerce routing result
    CheckoutCard.tsx       # Checkout session + payment link
    PaywallCard.tsx        # x402 paywall status
lib/
  tools.ts                # 10 OpenAI function definitions
  tool-executor.ts        # Server-side tool dispatcher
  coal-api.ts             # Coal API wrapper (12 functions)
  zero-g.ts               # Direct 0G Storage SDK download
  types.ts                # Types, suggested prompts, demo data
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for GPT-4o |
| `COAL_API_KEY` | Yes | Coal API key from console.usecoal.xyz |
| `COAL_API_URL` | No | Coal API base URL (default: https://api.usecoal.xyz) |
| `OPENAI_MODEL` | No | Model override (default: gpt-4o) |
