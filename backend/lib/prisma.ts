import './env'; // Validate required env vars at startup
import './0g/env'; // Validate optional 0G config and surface warnings when enabled
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

if (typeof window === "undefined") {
    neonConfig.webSocketConstructor = ws;
}

const connectionString = process.env.DATABASE_URL!;

// PrismaNeon only speaks Neon's WebSocket protocol. For local dev
// against a plain Postgres (e.g. world-3 integration testing), fall
// back to the generic pg adapter.
function isLocalPostgresUrl(url: string | undefined): boolean {
    if (!url) return false;
    try {
        const u = new URL(url);
        return u.protocol.startsWith('postgres') && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
    } catch {
        return false;
    }
}

const adapter = isLocalPostgresUrl(connectionString)
    ? new PrismaPg({ connectionString })
    : new PrismaNeon({ connectionString });

export const prisma = new PrismaClient({ adapter }) as PrismaClient;
