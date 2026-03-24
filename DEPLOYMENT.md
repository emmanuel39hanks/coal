# Coal Deployment Guide

This guide covers everything needed to deploy Coal (frontend + backend) to production on Vercel, with Neon PostgreSQL as the database.

Coal uses two auth surfaces:
- Merchant API requests use `x-api-key` with `coal_live_*` keys.
- Dashboard and `/api/console/*` routes use Privy Bearer JWTs.

---

## Prerequisites

| Requirement | Version / Notes |
|---|---|
| Node.js | 20+ |
| npm | Bundled with Node 20 |
| Neon account | [neon.tech](https://neon.tech) — serverless Postgres |
| Vercel account | [vercel.com](https://vercel.com) — hosts both apps |
| Alchemy account | [alchemy.com](https://alchemy.com) — Base RPC provider |
| Privy account | [privy.io](https://privy.io) — embedded wallets + auth |
| MoonPay account | [moonpay.com/business](https://www.moonpay.com/business) — fiat on-ramp |
| UploadThing account | [uploadthing.com](https://uploadthing.com) — file/image uploads |
| Resend account | [resend.com](https://resend.com) — transactional email |
| Upstash account | [upstash.com](https://upstash.com) — Redis rate limiting (optional) |

---

## Environment Variables

### Backend (`/backend`)

| Variable | Description | Where to get it | Required |
|---|---|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string | Neon dashboard → project → connection string | Yes |
| `ALCHEMY_API_KEY` | Alchemy API key for Base RPC | Alchemy dashboard → app → API key | Yes |
| `NEXT_PUBLIC_APP_URL` | Public URL of the frontend app | Your Vercel frontend deployment URL | Yes |
| `NEXT_PUBLIC_FRONTEND_URL` | Same as `NEXT_PUBLIC_APP_URL` | Your Vercel frontend deployment URL | Yes |
| `NEXT_PUBLIC_API_URL` | Public URL of the backend app | Your Vercel backend deployment URL | Yes |
| `CRON_SECRET` | Secret to authenticate cron requests | Generate: `openssl rand -base64 32` | Yes |
| `UPLOADTHING_SECRET` | UploadThing secret key | UploadThing dashboard → API keys | Yes |
| `UPLOADTHING_APP_ID` | UploadThing app ID | UploadThing dashboard → app settings | Yes |
| `UPLOADTHING_TOKEN` | UploadThing token | UploadThing dashboard → API keys | Yes |
| `RESEND_API_KEY` | Resend API key for email | Resend dashboard → API keys | Yes |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint | Upstash console → database → REST API | No |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token | Upstash console → database → REST API | No |
| `CHAIN_ENV` | Chain environment: `testnet` for Base Sepolia, empty for Base mainnet | Set manually | Yes |
| `MNEE_BASE_ADDRESS` | Legacy alias for `SETTLEMENT_TOKEN_ADDRESS` | Use only for older MNEE-based environments | No |
| `MNEE_BASE_DECIMALS` | Legacy alias for `SETTLEMENT_TOKEN_DECIMALS` (default: `6`) | Set to `6` only for legacy MNEE configs | No |
| `PRIVY_APP_ID` | Privy application ID | Privy dashboard → app settings | Yes |
| `PRIVY_APP_SECRET` | Privy application secret | Privy dashboard → app settings | Yes |
| `COMMERCE_PAYMENTS_OPERATOR_KEY` | Private key of the operator wallet (hex, `0x...`) | Your operator wallet | Yes |
| `COMMERCE_PAYMENTS_FEE_BPS` | Platform fee in basis points (e.g., `200` = 2%) | Set manually | Yes |

### Frontend (`/frontend`)

| Variable | Description | Where to get it | Required |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Public URL of the frontend | Your Vercel frontend deployment URL | Yes |
| `NEXT_PUBLIC_API_URL` | Public URL of the backend | Your Vercel backend deployment URL | Yes |
| `UPLOADTHING_SECRET` | UploadThing secret key | UploadThing dashboard → API keys | Yes |
| `UPLOADTHING_APP_ID` | UploadThing app ID | UploadThing dashboard → app settings | Yes |
| `UPLOADTHING_TOKEN` | UploadThing token | UploadThing dashboard → API keys | Yes |
| `NEXT_PUBLIC_MOONPAY_API_KEY` | MoonPay publishable API key | MoonPay dashboard → API keys | Yes |
| `NEXT_PUBLIC_MOONPAY_ENV` | `sandbox` or `production` | Set manually | Yes |
| `NEXT_PUBLIC_CHAIN_ENV` | `testnet` for Base Sepolia, empty for Base mainnet | Set manually | Yes |
| `NEXT_PUBLIC_MNEE_BASE_ADDRESS` | Legacy alias for `NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS` | Use only for older MNEE-based environments | No |
| `NEXT_PUBLIC_MNEE_BASE_DECIMALS` | Legacy alias for `NEXT_PUBLIC_SETTLEMENT_TOKEN_DECIMALS` (default: `6`) | Set to `6` only for legacy MNEE configs | No |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy application ID | Privy dashboard → app settings | Yes |

---

## Database Setup (Neon)

1. Sign in to [neon.tech](https://neon.tech) and create a new project.
2. Select a region close to your Vercel deployment region.
3. From the project dashboard, copy the **connection string** (pooled connection recommended for serverless).
   It looks like: `postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require`
4. Set `DATABASE_URL` to this value in your backend environment.
5. Run migrations:

```bash
cd backend
npm install
npx prisma migrate deploy
```

> For local development, use `npx prisma migrate dev` instead to create and apply migrations interactively.

---

## Local Development

### 1. Clone and install

```bash
git clone https://github.com/your-org/coal.git
cd coal

# Install backend dependencies
cd backend && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Configure environment variables

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your values

# Frontend
cp frontend/.env.example frontend/.env
# Edit frontend/.env with your values
```

### 3. Run database migrations

```bash
cd backend
npx prisma migrate dev
cd ..
```

### 4. Start both apps

Open two terminal windows:

```bash
# Terminal 1 — backend (runs on http://localhost:3001)
cd backend
npm run dev

# Terminal 2 — frontend (runs on http://localhost:3000)
cd frontend
npm run dev
```

The frontend expects the backend at `NEXT_PUBLIC_API_URL=http://localhost:3001`.

---

## Deploying to Vercel

Coal deploys as **two separate Vercel projects** — one for the backend, one for the frontend.

### Step 1: Deploy the backend

1. Go to [vercel.com/new](https://vercel.com/new) and import your repository.
2. When prompted for the **Root Directory**, set it to `backend`.
3. Framework preset: **Next.js** (auto-detected).
4. Add all backend environment variables (see table above).
5. Click **Deploy**.
6. Note your backend deployment URL (e.g., `https://coal-backend.vercel.app`).

### Step 2: Deploy the frontend

1. Import the same repository again as a new Vercel project.
2. When prompted for the **Root Directory**, set it to `frontend`.
3. Framework preset: **Next.js** (auto-detected).
4. Add all frontend environment variables (see table above).
5. Set `NEXT_PUBLIC_API_URL` to your backend deployment URL from Step 1.
6. Click **Deploy**.
7. Note your frontend deployment URL (e.g., `https://usecoal.xyz`).

### Step 3: Update cross-references

After both deployments are live, go back to the **backend** Vercel project settings and update:
- `NEXT_PUBLIC_APP_URL` → frontend deployment URL
- `NEXT_PUBLIC_FRONTEND_URL` → frontend deployment URL

Redeploy the backend after updating these values.

### Setting up Vercel Cron (verify-payments)

The `verify-payments` cron job polls pending payments and confirms on-chain transactions.

1. In the Vercel backend project — **Settings** — **Cron Jobs**, verify the cron is listed.
2. The cron calls `GET /api/cron/verify-payments` with `Authorization: Bearer <CRON_SECRET>`.
3. Set `CRON_SECRET` to a strong random string in the backend environment variables.
4. Vercel will call the cron automatically on the configured schedule (default: every minute).

---

## Alchemy Setup

1. Sign in to [alchemy.com](https://alchemy.com) and create a new app.
2. Select **Base** as the network (Base Mainnet for production, Base Sepolia for testnet).
3. From the app dashboard, copy the **API Key**.
4. Set `ALCHEMY_API_KEY` in the backend environment.

The backend uses this key to construct RPC URLs for Base:
- Mainnet: `https://base-mainnet.g.alchemy.com/v2/<API_KEY>`
- Testnet: `https://base-sepolia.g.alchemy.com/v2/<API_KEY>`

---

## Privy Setup

1. Sign in to [privy.io](https://privy.io) and create a new app.
2. In **Embedded Wallets**, enable wallet creation for your app.
3. Under **Login Methods**, enable the auth methods you want (email, Google, Apple, etc.).
4. From **Settings**, copy:
   - **App ID** — set as `NEXT_PUBLIC_PRIVY_APP_ID` (frontend) and `PRIVY_APP_ID` (backend)
   - **App Secret** — set as `PRIVY_APP_SECRET` (backend only — never expose this to the frontend)
5. In **Allowed Origins**, add your frontend deployment URL.

Legacy Better Auth has been retired. The dashboard is Privy-authenticated end to end.

---

## MoonPay Setup

MoonPay powers the fiat on-ramp (buy crypto with card).

1. Create a developer account at [moonpay.com/business](https://www.moonpay.com/business).
2. In the dashboard, navigate to **API Keys**.
3. For testing, use the **Sandbox publishable key** and set `NEXT_PUBLIC_MOONPAY_ENV=sandbox`.
4. Test the flow end-to-end using MoonPay's sandbox environment.
5. When ready for production:
   - Complete MoonPay's KYB (business verification) process.
   - Switch to the **Live publishable key**.
   - Set `NEXT_PUBLIC_MOONPAY_ENV=production`.

> The frontend only uses the publishable key (`NEXT_PUBLIC_MOONPAY_API_KEY`). Never expose secret keys to the frontend.

---

## Settlement Token

Coal settles directly on Base into the merchant's configured settlement token. If you do not configure a custom token, Coal falls back to USDC.

If you still run a legacy MNEE environment, you can continue using the `MNEE_*` aliases:
- `MNEE_BASE_ADDRESS` / `NEXT_PUBLIC_MNEE_BASE_ADDRESS`
- `MNEE_BASE_DECIMALS` / `NEXT_PUBLIC_MNEE_BASE_DECIMALS`

New deployments should prefer `SETTLEMENT_TOKEN_*` and `NEXT_PUBLIC_SETTLEMENT_TOKEN_*`.

---

## Post-Deployment Checklist

- [ ] Backend health check returns `200 ok`: `GET https://your-backend.vercel.app/api/health`
- [ ] Frontend loads without errors at your deployment URL
- [ ] Create a test payment link via the console and open it
- [ ] Complete a test payment end-to-end (use Base Sepolia testnet with `CHAIN_ENV=testnet`)
- [ ] Verify the transaction appears in the merchant's console dashboard
- [ ] Confirm webhook fires for the test merchant (set a webhook URL in console — check delivery logs)
- [ ] Verify the Vercel cron job (`verify-payments`) is running: Vercel dashboard — Cron Jobs — last run time
- [ ] Confirm emails are delivered (sign up, verify email) via Resend dashboard
- [ ] Switch to MoonPay production key and test fiat on-ramp flow
- [ ] Set `SETTLEMENT_TOKEN_ADDRESS` / `NEXT_PUBLIC_SETTLEMENT_TOKEN_ADDRESS` if you want a custom settlement asset instead of the USDC fallback
- [ ] Set `CHAIN_ENV` to empty string (or remove it) to switch to Base Mainnet for production
- [ ] Set `NEXT_PUBLIC_MOONPAY_ENV=production` for the live on-ramp
