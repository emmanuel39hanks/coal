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

## 📁 Project Structure

```
coal/
├── backend/          # Next.js API server (port 3001)
├── frontend/         # Next.js frontend + docs (port 3000)
├── examples/
│   └── demo-store/   # Example merchant store (port 3002)
└── docs/             # MNEE documentation
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL (or use Supabase)
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

### 4. Demo Store Setup (Optional)

```bash
cd examples/demo-store
npm install
```

Create `.env`:

```env
COAL_API_URL=http://localhost:3001/api/checkouts
COAL_API_KEY=coal_live_your_api_key_here
```

Start the demo store:

```bash
npm run dev
```

## 🔌 API Usage

### Create a Checkout Session

```bash
curl -X POST http://localhost:3001/api/checkouts \
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
  "url": "http://localhost:3000/pay/clv9abc123...",
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

## 📖 Documentation

Visit `http://localhost:3000/docs` for full API documentation including:
- Authentication
- Checkout Sessions
- Payment Links
- Webhooks
- Products API

## 🧪 Testing Payments

1. Get MNEE tokens from the [MNEE Swap](https://swap-user.mnee.net)
2. Connect MetaMask to Ethereum Mainnet
3. Create a checkout via API or demo store
4. Complete payment with MNEE

## 📝 Environment Variables Summary

### Backend (.env)

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `BETTER_AUTH_SECRET` | Auth encryption key | ✅ |
| `ALCHEMY_API_KEY` | Alchemy RPC key | ✅ |
| `GOOGLE_CLIENT_ID` | Google OAuth ID | ✅ |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | ✅ |

### Frontend (.env)

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_API_URL` | Backend URL | ✅ |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | WalletConnect ID | ✅ |

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🏆 Built for MNEE Hackathon

Coal was built for the [MNEE Hackathon](https://mnee-hackathon.devpost.com/) to demonstrate programmable money for commerce using the MNEE USD stablecoin on Ethereum.

---

**Made with ⚡**
