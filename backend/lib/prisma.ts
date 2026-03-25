import './env'; // Validate required env vars at startup
import './0g/env'; // Validate optional 0G config and surface warnings when enabled
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

if (typeof window === "undefined") {
    neonConfig.webSocketConstructor = ws;
}

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaNeon({ connectionString });

export const prisma = new PrismaClient({ adapter }) as PrismaClient;
