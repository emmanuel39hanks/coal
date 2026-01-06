# Coal Product Specification

**Mission**: Make MNEE the easiest stablecoin to accept in apps.
**Core Value**: Programmable Checkout & Payouts. No custom contracts. Instant settlement.

## The Flow

### 1. Create a Checkout (API)
- **Actor**: Developer / App
- **Action**: Calls `POST /api/checkout`
- **Output**: Coal returns a payment URL (e.g., `coal.app/pay/xyz`).

### 2. User Pays (Frontend)
- **Actor**: End User
- **Action**: User visits payment URL, connects wallet, pays with MNEE.
- **System**: Coal tracks the transaction on-chain.

### 3. Instant Split & Settle (Smart Contract)
- **Actor**: Coal System / Blockchain
- **Action**: Funds are transferred and automatically split to recipients.
- **Output**: Webhook triggered to Developer.

## Key Features

### In-App Checkouts
Sell digital goods, credits, or features inside apps seamlessly.

### Paywalls
Lock content or APIs behind MNEE payments.

### Revenue Splits
Automatically split payments between Platform, Creator, Partner, and DAO.
Example: 95% to Merchant, 5% to Platform.

### Simple Payouts
Send funds directly to settlement wallets. No custody risk.

## Core Values

- **Non-Custodial**: We never hold funds.
- **On-Chain**: Verifiable on Ethereum/MNEE.
- **Instant**: No settlement delays.
- **Programmable**: Driven by API.
