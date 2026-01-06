Ah, now we’re getting into the “hands-on building” part — let me break this down carefully and practically. I’ll go **step by step**, explain what each piece is, where it lives, and how things like auto-split work. We’ll treat this as your “Day 1 + Day 2 roadmap” for a **Next.js + Prisma + Neon + Coal payment platform** setup.

---

## **Day 1 – Backend & Core Setup**

### **1️⃣ Next.js setup**

* **Goal:** Your app + backend in one project (or split if you want `api.usecoal.xyz` separate).
* **Implementation:**

  * If single repo: `npx create-next-app@latest --typescript --api` → gives you `/app/api` folder for endpoints.
  * If split: one repo for frontend (`usecoal.xyz`) and one for API (`api.usecoal.xyz`), each with Next.js.
* **What lives where:**

  * Frontend pages (`/app/page.tsx`) → UI, forms, landing, pay page.
  * Backend endpoints (`/app/api/.../route.ts`) → handle API requests, database calls, MNEE transfers.

---

### **2️⃣ Prisma + Neon (Postgres)**

* **Goal:** Store users, transactions, API keys, items.
* **Implementation:**

  * `prisma init` → create schema.
  * Models you might need:

    ```prisma
    model User {
      id          String   @id @default(cuid())
      email       String   @unique
      password    String
      apiKeys     ApiKey[]
      transactions Transaction[]
    }

    model ApiKey {
      id        String @id @default(cuid())
      key       String
      secret    String
      user      User   @relation(fields: [userId], references: [id])
      userId    String
      createdAt DateTime @default(now())
      revoked   Boolean  @default(false)
    }

    model Transaction {
      id        String   @id @default(cuid())
      user      User     @relation(fields: [userId], references: [id])
      userId    String
      amount    Float
      status    String   // pending, success, failed
      createdAt DateTime @default(now())
    }
    ```
  * Connect Prisma to **Neon Postgres** → you now have a robust DB for your platform.

---

### **3️⃣ BetterAuth dashboard**

* **Goal:** Handle user registration, login, password resets.
* **Implementation:**

  * Use BetterAuth (or Supabase Auth) to handle authentication.
  * Frontend: login/register forms → send to `/api/auth` endpoints.
  * Store auth session in cookies or JWT for Next.js API calls.

---

### **4️⃣ API key generation**

* **Goal:** Give users keys to call your API.
* **Implementation:**

  * Endpoint `/api/apikeys/create` → generates a random key + secret, stores in DB.
  * Only show **secret once** to user.
  * Users use key + secret to call `/api/pay` or `/api/checkout`.

---

### **5️⃣ Create checkout API**

* **Goal:** Process payments programmatically.
* **Implementation:**

  * Endpoint: `/api/checkout`
  * Input: `{ amount, currency, items[], userKey }`
  * Backend:

    1. Validate API key
    2. Create a transaction record (pending)
    3. Trigger MNEE transfer
    4. Update transaction status (success/failed)
* **Hosted where:**
  This is **always on your backend** (`api.usecoal.xyz`). Frontend can call it via `fetch('/api/checkout')`.

---

## **Day 2 – Frontend / UX & Advanced Logic**

### **1️⃣ Pay page**

* **Goal:** Let users pay for items or send money.
* **Implementation:**

  * Page at `/pay` or `/checkout`
  * UI:

    * Amount input
    * Item list (optional)
    * “Pay” button → calls your checkout API
  * Hosted **on your frontend** (`usecoal.xyz/pay`), calls API hosted on backend (`api.usecoal.xyz/api/checkout`).

---

### **2️⃣ MNEE transfer**

* **Goal:** Actually send money (crypto or stablecoin) to recipient.
* **Implementation:**

  * Use your MNEE blockchain integration (wallet SDK or RPC)
  * Backend function:

    ```ts
    async function sendMNEE(from: string, to: string, amount: number) {
        // call MNEE blockchain API
        // return txHash or error
    }
    ```
  * Hook this into checkout → update transaction after success/failure.

---

### **3️⃣ Auto split**

* **Goal:** Split a single payment to multiple recipients automatically.
* **Implementation logic:**

  1. Receive payment amount
  2. Define split rules (e.g., 70% to seller, 30% to platform)
  3. Execute transfers sequentially or via smart contract if MNEE supports it
  4. Store individual transfers in DB
* **Example:**

  ```ts
  const total = 100;
  const seller = 70;
  const platform = 30;
  await sendMNEE(payerWallet, sellerWallet, seller);
  await sendMNEE(payerWallet, platformWallet, platform);
  ```

---

### **4️⃣ Demo store**

* **Goal:** Test your checkout API in a realistic scenario.
* **Implementation:**

  * Create sample items in DB
  * Users can “buy” items → triggers checkout + auto split
  * Useful for testing frontend + backend + MNEE transfer flow

---

### **5️⃣ Clean landing page**

* **Goal:** Present your platform for real users.
* **Implementation:**

  * `/` → hero section, features, quick start guide
  * Buttons: “Create account”, “Go to dashboard”, “Demo store”
  * Hosted **on your frontend**, calls backend API as needed

---

## ✅ **Key Takeaways**

* **Pay page lives on frontend**, calls your **backend API** to execute payments.
* **Auto split is backend logic**, can be implemented via sequential transfers or smart contract.
* **Frontend + backend separation** gives you `usecoal.xyz` (UI) + `api.usecoal.xyz` (API).
* **Database** (Prisma + Neon) is the source of truth for users, transactions, keys, and items.

---