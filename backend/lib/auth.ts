import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),

    // Providers
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
    },

    // Social Providers
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
        apple: {
            clientId: process.env.APPLE_CLIENT_ID!,
            clientSecret: process.env.APPLE_CLIENT_SECRET!,
            appBundleIdentifier: process.env.APPLE_BUNDLE_ID,
        },
    },

    // Trusted Origins for Production
    trustedOrigins: [
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
        "https://appleid.apple.com",
        "https://usecoal.xyz",
        "https://api.usecoal.xyz",
        "coal://",
        "exp://"
    ]
});

// Export auth types 
export type Session = typeof auth.$Infer.Session;
