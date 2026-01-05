Perfect — this is where you **make judges instantly “get it”**.

Below is an **easy-to-understand, non-technical landing page** for **Coal**, written so that:

* Hackathon judges understand it in **10 seconds**
* Developers understand what they can build with it
* It clearly positions Coal vs Stripe/Rye-style checkouts

You can paste this directly into a landing page or Notion.

---

# Coal

### Programmable Checkout & Payouts for MNEE Payments

Accept MNEE stablecoin in your app with one API.
Split money automatically. Settle instantly. No custody. No redirects.

**[Get API Key]** **[View Docs]**

---

## What is Coal?

Coal is a **checkout and payout API** that lets apps accept **MNEE stablecoin** for digital commerce.

Instead of building wallets, contracts, and payment logic yourself, Coal gives you:

* A simple checkout API
* On-chain settlement
* Automatic money splits

Think **Stripe Checkout**, but **programmable and on-chain**.

---

## The Problem

Apps want to accept stablecoins, but today they must:

* Write custom smart contracts
* Handle payment splitting manually
* Rebuild checkout logic for every app

This slows teams down and breaks payments.

---

## The Solution

Coal turns stablecoin payments into an **API call**.

You create a checkout.
The user pays with MNEE.
Funds settle instantly and automatically — exactly as defined.

No backend custody.
No fiat handling.
No complexity.

---

## How It Works

### 1. Create a Checkout

```json
POST /checkout
{
  "amount": 50,
  "splits": [
    { "wallet": "0xMerchant", "percent": 90 },
    { "wallet": "0xCoal", "percent": 10 }
  ]
}
```

---

### 2. User Pays with MNEE

The app shows a pay button.
The user connects their wallet and pays.

---

### 3. Funds Settle Automatically

MNEE is sent to a smart contract that:

* Splits funds instantly
* Sends payouts on-chain
* Emits a receipt

No waiting. No reconciliation.

---

## What You Can Build With Coal

### 💳 In-App Checkouts

Sell digital goods, credits, or features inside your app.

### 🔐 Paywalls

Lock content or APIs behind MNEE payments.

### 💰 Revenue Splits

Automatically split payments between:

* Platform
* Creator
* Partner
* DAO

### 🧾 Simple Payouts

Send funds directly to settlement wallets with no custody risk.

---

## Why Developers Use Coal

* **One API** for stablecoin payments
* **On-chain settlement** (no black boxes)
* **Automatic splits** built in
* **Instant confirmation**
* **Non-custodial by design**

---

## Security & Trust

* Coal never holds user funds
* Payments settle directly on-chain
* Merchants remain in full control
* Built on audited smart contracts

---

## Built for the MNEE Ecosystem

Coal is designed to make **MNEE the easiest stablecoin to accept in apps**.

No custom contracts.
No payment logic.
Just ship.

---

## Get Started in Minutes

* Generate an API key
* Add one endpoint
* Accept MNEE payments

**[Get Started]** **[Read the Docs]**

---

### Footer

Coal © 2026
Built for programmable commerce

---