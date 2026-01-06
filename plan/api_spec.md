# Coal API Specification

**Base URL**: `https://api.coal.app` (or `http://localhost:3001/api` for dev)
**Auth**: `x-api-key` header (Account Access).

## Endpoints

### 1. Create Checkout
`POST /api/checkout`

**Request**:
```json
{
  "description": "Pro Membership",
  "amount": 50.00,
  "currency": "MNEE",
  "splits": [
    { "wallet": "0xMerchantAddress", "percent": 95 },
    { "wallet": "0xPlatformAddress", "percent": 5 }
  ],
  "callbackUrl": "https://myapp.com/webhook",
  "redirectUrl": "https://myapp.com/success"
}
```

**Response**:
```json
{
  "id": "chk_123abc",
  "url": "https://coal.app/pay/chk_123abc",
  "status": "pending",
  "expiresAt": "2026-01-05T12:00:00Z"
}
```

### 2. Verify Payment (Webhook)
**Event**: `payment.confirmed`

**Payload**:
```json
{
  "id": "chk_123abc",
  "status": "confirmed",
  "txHash": "0x...",
  "amount": 50.00,
  "currency": "MNEE",
  "metadata": { "orderId": "6789" }
}
```

## Webhooks & Notifications

### Security
All webhooks are signed with `HMAC-SHA256`.
**Header**: `Coal-Signature: t=123456,v1=abcdef...`
**Verification**: Hash the payload + timestamp with your `webhook_secret`.

### Events
- `checkout.created`: User opened the payment page.
- `payment.confirmed`: Success (Money entered wallet).
- `payment.failed`: User rejected or transaction failed.

### Retries
Coal retries webhooks 5 times with exponential backoff.

## Console API (Internal/Private)
Powered by Session Auth (Cookie)

### Overview
- `GET /api/console/stats`: Returns Revenue, Tx Count, Active Products.

### Transactions
- `GET /api/console/transactions`: List recent payments.
- `GET /api/console/transactions/[id]`: Transaction details.

### Products & Images
- `GET /api/console/products`: List products.
- `POST /api/console/products`: Create product (Name, Price, Image).
- `DELETE /api/console/products/[id]`: Archive product.

### Payment Links
- `GET /api/console/links`: List active payment links.
- `POST /api/console/links`: Create a new permanent link.

### Developer Keys
- `GET /api/console/keys`: List API keys.
- `POST /api/console/keys`: Generate new secret key.
- `DELETE /api/console/keys/[id]`: Revoke key.

### Settings
- `GET /api/console/settings`: Get profile & payout wallet.
- `PUT /api/console/settings`: Update payout wallet.
