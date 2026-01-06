# 📘 Modern Backend Guide: Next.js + Better Auth + Prisma 7 + NeonDB

This guide documents the setup for a high-performance, serverless-ready backend using the latest versions of our stack.

---

## 1. 📦 Installation

Install the core dependencies. Note the specific adapter packages for Neon and Prisma 7.

```bash
# Core
npm install better-auth @better-auth/expo
npm install @prisma/client@latest @prisma/adapter-neon@latest @neondatabase/serverless ws

# Dev Dependencies
npm install -D prisma@latest @types/ws
```

---

## 2. 🗄️ Database & Prisma Setup (v7.2.0+)

Prisma 7 introduces a new configuration flow that separates the CLI config from the schema.

### A. The Schema (`prisma/schema.prisma`)
**CRITICAL:** Do NOT put the `url` in the `datasource` block anymore.

```prisma
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "postgresql"
  // url = env("DATABASE_URL") <--- REMOVE THIS!
}

// ... your models ...
```

### B. The Configuration (`prisma.config.ts`)
Create this file in your root. This tells the Prisma CLI where to connect during migrations.

```typescript
import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
    schema: path.join("prisma", "schema.prisma"),
    datasource: {
        url: env("DATABASE_URL"), // CLI gets URL here
    },
});
```

### C. The Runtime Client (`lib/prisma.ts`)
We use the Neon Serverless driver for connection pooling over WebSockets.

```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

if (typeof window === "undefined") {
    neonConfig.webSocketConstructor = ws;
}

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaNeon({ connectionString });

export const prisma = new PrismaClient({ adapter });
```

---

## 3. 🔐 Better Auth Configuration

### A. Server Config (`lib/auth.ts`)
Connect Better Auth to Prisma and define your providers.

```typescript
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { expo } from "@better-auth/expo"; // If mobile is needed

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),
    
    // Providers
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false, 
    },
    socialProviders: {
        google: {
             clientId: process.env.GOOGLE_CLIENT_ID!,
             clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
        apple: {
             clientId: process.env.APPLE_CLIENT_ID!,
             clientSecret: process.env.APPLE_CLIENT_SECRET!,
             appBundleIdentifier: process.env.APPLE_BUNDLE_ID,
        }
    },
    
    // Plugins
    plugins: [ expo() ],
    
    // Security
    trustedOrigins: [
        "https://usecoal.xyz",
        "https://your-production-url.com",
        "your-app-scheme://"
    ]
});
```

---

## 4. 🛠️ CLI & Schema Generation

Better Auth can automatically generate the Prisma models you need.

### Step 1: Generate Schema
Run the Better Auth CLI to inspect your `lib/auth.ts` config and update your `schema.prisma` automatically.

```bash
npx @better-auth/cli@latest generate
```

This will add `User`, `Session`, `Account`, `Verification` to your schema.

### Step 2: Push to Database
Apply the changes to your Neon database and regenerate the Prisma Client.

```bash
npx prisma db push
```

> **Note:** If you use migrations instead of push:
> `npx prisma migrate dev --name init_auth`

---

## 5. ⚠️ Common "Gotchas"

### Missing Fields
If Better Auth throws `Unknown argument`, it means your Prisma Client is out of sync with your Schema, or your Schema is missing fields.
*   **Fix:** Check schema, run `npx prisma db push`.

### "Cannot find module .prisma/client/default"
Happens after upgrading libraries.
*   **Fix:** `rm -rf .next` -> `npx prisma generate` -> `npm run dev`.

### Lockfile Warning
"Detected additional lockfiles".
*   **Fix:** Stick to one package manager. If using npm, ensure `yarn.lock` or `pnpm-lock.yaml` are deleted.

---

## 6. 🌍 Environment Variables Reference

```bash
# Database
DATABASE_URL="postgres://user:pass@ep-xyz.aws.neon.tech/neondb?sslmode=require"

# Auth Base
BETTER_AUTH_SECRET="<generate-random-string>"
BETTER_AUTH_URL="https://api.usecoal.xyz"

# Google
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
