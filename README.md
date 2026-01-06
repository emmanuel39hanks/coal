# Coal ⚡

**The Stripe for MNEE Stablecoin Payments**

Coal is a payment infrastructure that enables merchants to accept MNEE stablecoin payments with instant settlement, on-chain verification, and a beautiful checkout experience.

![Coal Demo](https://img.shields.io/badge/Built%20for-MNEE%20Hackathon-orange)
![License](https://img.shields.io/badge/License-MIT-blue)
![Next.js](https://img.shields.io/badge/Next.js-16.1-black)

## 🎯 What is Coal?

Coal provides:
- **Merchant Console** - Manage products, payment links, and API keys
- **Checkout API** - Create payment sessions programmatically
- **Payment Links** - Shareable links for quick payments
- **On-chain Verification** - Real transaction validation via Alchemy RPC
- **Instant Settlement** - Funds go directly to merchant wallets

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Demo Store    │────▶│   Coal Backend  │────▶│  Ethereum RPC   │
│  (Your App)     │     │   (API Layer)   │     │   (Alchemy)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │  Coal Frontend  │
                        │  (Checkout UI)  │
                        └─────────────────┘
```

**Note:** Backend and Frontend are deployed as **separate** Next.js applications:
- **Backend** - API-only Next.js app with Prisma (no UI)
- **Frontend** - UI app that calls backend APIs

## 📁 Project Structure

```
coal/
├── backend/          # Next.js API server (Vercel Project 1)
├── frontend/         # Next.js frontend + docs (Vercel Project 2)
├── examples/
│   └── demo-store/   # Example merchant store
└── docs/             # MNEE documentation
```

## 🚀 Quick Start (Local Development)

### Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL (or use Supabase/Neon)
- Alchemy API key (free tier works)

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/coal.git
cd coal
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create `.env`:

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/coal?sslmode=require"

# Auth (Better Auth)
BETTER_AUTH_SECRET="your-secret-key-here"
BETTER_AUTH_URL="http://localhost:3001"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Blockchain
ALCHEMY_API_KEY="your-alchemy-api-key"
NEXT_PUBLIC_CHAIN_ID="1"

# URLs
NEXT_PUBLIC_FRONTEND_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3001"
```

Run database migrations:

```bash
npx prisma db push
```

Start the backend:

```bash
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create `.env`:

```env
# API
NEXT_PUBLIC_API_URL="http://localhost:3001"

# ConnectKit / Wagmi
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID="your-walletconnect-id"

# Auth
AUTH_SECRET="your-auth-secret"
```

Start the frontend:

```bash
npm run dev
```

---

## ☁️ Vercel Deployment

Since backend and frontend are in the same repository, you need to create **two separate Vercel projects** pointing to the same repo but with different root directories.

### Deploy Backend

1. **Create new Vercel project** → Import your repository
2. **Configure project:**
   - **Root Directory:** `backend`
   - **Framework Preset:** Next.js
   - **Build Command:** `npm run build` (includes `prisma generate`)
   - **Output Directory:** Leave default

3. **Add Environment Variables:**

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `postgresql://...` |
| `BETTER_AUTH_SECRET` | `your-secret` |
| `BETTER_AUTH_URL` | `https://your-backend.vercel.app` |
| `GOOGLE_CLIENT_ID` | `your-google-id` |
| `GOOGLE_CLIENT_SECRET` | `your-google-secret` |
| `ALCHEMY_API_KEY` | `your-alchemy-key` |
| `NEXT_PUBLIC_CHAIN_ID` | `1` |
| `NEXT_PUBLIC_FRONTEND_URL` | `https://your-frontend.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | `https://your-backend.vercel.app` |

4. **Deploy!**

### Deploy Frontend

1. **Create another Vercel project** → Import the **same** repository
2. **Configure project:**
   - **Root Directory:** `frontend`
   - **Framework Preset:** Next.js
   - **Build Command:** Leave default
   - **Output Directory:** Leave default

3. **Add Environment Variables:**

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://your-backend.vercel.app` |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | `your-walletconnect-id` |
| `AUTH_SECRET` | `your-auth-secret` |

4. **Deploy!**

### Important Notes

- **Prisma Generation:** Backend's `postinstall` script automatically runs `prisma generate`
- **CORS:** Backend is configured to allow requests from `NEXT_PUBLIC_FRONTEND_URL`
- **Frontend doesn't need Prisma** - it only calls backend APIs

---

## 🔌 API Usage

### Create a Checkout Session

```bash
curl -X POST https://your-backend.vercel.app/api/checkouts \
  -H "Content-Type: application/json" \
  -H "x-api-key: coal_live_12345..." \
  -d '{
    "amount": 25.00,
    "productName": "Premium Hoodie",
    "redirectUrl": "https://yoursite.com/success"
  }'
```

### Response

```json
{
  "id": "clv9abc123...",
  "url": "https://your-frontend.vercel.app/pay/clv9abc123...",
  "status": "pending",
  "amount": 25.00,
  "currency": "MNEE"
}
```

### Redirect User

Redirect your customer to the `url` returned. Coal handles:
- Wallet connection (MetaMask, WalletConnect)
- MNEE token transfer
- On-chain verification
- Success redirect

## 💰 MNEE Token Details

- **Contract Address**: `0x8ccedbAe4916b79da7F3F612EfB2EB93A2bFD6cF`
- **Decimals**: 18 (standard ERC-20)
- **Network**: Ethereum Mainnet

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Next.js 16, Prisma, PostgreSQL |
| Frontend | Next.js 16, React, TailwindCSS |
| Auth | Better Auth, Google OAuth |
| Wallet | ConnectKit, Wagmi, Viem |
| RPC | Alchemy |
| Token | MNEE (ERC-20) |
| Deployment | Vercel |

## 📖 Documentation

Visit `https://your-frontend.vercel.app/docs` for full API documentation.

## 📝 Environment Variables Summary

### Backend

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `BETTER_AUTH_SECRET` | Auth encryption key | ✅ |
| `BETTER_AUTH_URL` | Backend URL | ✅ |
| `ALCHEMY_API_KEY` | Alchemy RPC key | ✅ |
| `GOOGLE_CLIENT_ID` | Google OAuth ID | ✅ |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | ✅ |
| `NEXT_PUBLIC_FRONTEND_URL` | Frontend URL | ✅ |
| `NEXT_PUBLIC_APP_URL` | Backend URL (self) | ✅ |

### Frontend

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_API_URL` | Backend URL | ✅ |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | WalletConnect ID | ✅ |
| `AUTH_SECRET` | Auth secret | ✅ |

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏆 Built for MNEE Hackathon

Coal was built for the [MNEE Hackathon](https://mnee-hackathon.devpost.com/) to demonstrate programmable money for commerce using the MNEE USD stablecoin on Ethereum.

---

**Made with ⚡**
