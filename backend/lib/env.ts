/**
 * Environment variable validation — runs at module load time.
 * Import this early (e.g. from prisma.ts) to catch missing config before any request is served.
 */
import { logger } from '@/lib/logger';

const errors: string[] = [];
const warnings: string[] = [];

function readEnv(key: string) {
    const value = process.env[key];
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
}

function pushError(message: string) {
    errors.push(`[Coal env] ${message}`);
}

function pushWarning(message: string) {
    warnings.push(`[Coal env] ${message}`);
}

function requireEnv(key: string, reason?: string) {
    const value = readEnv(key);
    if (!value) {
        pushError(`Missing required environment variable: ${key}${reason ? ` (${reason})` : ''}`);
    }
    return value;
}

function validateAllOrNone(
    label: string,
    keys: readonly string[],
    options: {
        absent?: 'ignore' | 'warn' | 'error';
        reason?: string;
    } = {},
) {
    const values = keys.map((key) => readEnv(key));
    const presentCount = values.filter(Boolean).length;

    if (presentCount === 0) {
        if (options.absent === 'warn') {
            pushWarning(`${label} is not configured${options.reason ? ` (${options.reason})` : ''}`);
        } else if (options.absent === 'error') {
            pushError(`${label} is required${options.reason ? ` (${options.reason})` : ''}`);
        }
        return;
    }

    if (presentCount !== keys.length) {
        const missing = keys.filter((_, index) => !values[index]);
        pushError(`${label} is partially configured; missing ${missing.join(', ')}`);
    }
}

function validatePositiveInteger(key: string) {
    const value = readEnv(key);
    if (!value) return;
    if (!/^\d+$/.test(value)) {
        pushError(`${key} must be a positive integer`);
    }
}

const NODE_ENV = readEnv('NODE_ENV') || 'development';
const isProduction = NODE_ENV === 'production';

const DATABASE_URL = requireEnv('DATABASE_URL', 'database connection');
const ALCHEMY_API_KEY = requireEnv('ALCHEMY_API_KEY', 'Base RPC access');

validateAllOrNone('Privy auth', ['PRIVY_APP_ID', 'PRIVY_APP_SECRET'], {
    absent: isProduction ? 'error' : 'warn',
    reason: 'required for dashboard and console authentication',
});

validateAllOrNone('UploadThing', ['UPLOADTHING_SECRET', 'UPLOADTHING_APP_ID', 'UPLOADTHING_TOKEN'], {
    absent: 'warn',
    reason: 'required for uploads',
});

const moonPayPublishable = readEnv('MOONPAY_PUBLISHABLE_KEY') || readEnv('NEXT_PUBLIC_MOONPAY_API_KEY');
const moonPaySecret = readEnv('MOONPAY_SECRET_KEY');
const moonPayConfigured = Boolean(moonPayPublishable || moonPaySecret);
if (moonPayConfigured && (!moonPayPublishable || !moonPaySecret)) {
    pushError('MoonPay is partially configured; set both MOONPAY_SECRET_KEY and MOONPAY_PUBLISHABLE_KEY (or NEXT_PUBLIC_MOONPAY_API_KEY)');
}
if (moonPayConfigured && !readEnv('MOONPAY_WEBHOOK_API_KEY')) {
    pushWarning('MOONPAY_WEBHOOK_API_KEY is missing; MoonPay webhook signatures cannot be verified');
}

validateAllOrNone('Upstash Redis', ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'], {
    absent: 'warn',
    reason: 'used for distributed rate limiting',
});

if (
    readEnv('ENABLE_LEGACY_BETTER_AUTH') ||
    readEnv('BETTER_AUTH_SECRET') ||
    readEnv('GOOGLE_CLIENT_ID') ||
    readEnv('GOOGLE_CLIENT_SECRET') ||
    readEnv('APPLE_CLIENT_ID') ||
    readEnv('APPLE_CLIENT_SECRET') ||
    readEnv('APPLE_BUNDLE_ID')
) {
    pushWarning('Legacy Better Auth env vars are set, but the compatibility route has been retired and these values are now ignored');
}

if (!readEnv('RESEND_API_KEY')) {
    pushWarning('RESEND_API_KEY is missing; email delivery will be disabled');
}

if (!readEnv('COMMERCE_PAYMENTS_OPERATOR_KEY')) {
    pushWarning('COMMERCE_PAYMENTS_OPERATOR_KEY is missing; capture/refund/void flows will fail');
}

const CHAIN_ENV = readEnv('CHAIN_ENV') || '';
if (CHAIN_ENV && CHAIN_ENV !== 'testnet') {
    pushError(`CHAIN_ENV must be empty or "testnet", received "${CHAIN_ENV}"`);
}

if (!readEnv('NEXT_PUBLIC_FRONTEND_URL')) {
    pushWarning('NEXT_PUBLIC_FRONTEND_URL is missing; falling back to http://localhost:3000');
}
if (!readEnv('NEXT_PUBLIC_APP_URL')) {
    pushWarning('NEXT_PUBLIC_APP_URL is missing; falling back to http://localhost:3000');
}
if (!readEnv('NEXT_PUBLIC_API_URL')) {
    pushWarning('NEXT_PUBLIC_API_URL is missing; some generated backend URLs may be incorrect');
}
if (!readEnv('CRON_SECRET')) {
    if (isProduction) {
        pushError('CRON_SECRET is required in production for authenticated cron routes');
    } else {
        pushWarning('CRON_SECRET is missing; cron routes cannot be authenticated');
    }
}

const settlementAddress = readEnv('SETTLEMENT_TOKEN_ADDRESS') || readEnv('MNEE_BASE_ADDRESS');
const settlementDecimals = readEnv('SETTLEMENT_TOKEN_DECIMALS') || readEnv('MNEE_BASE_DECIMALS');
const settlementConfigured = Boolean(
    settlementAddress ||
    settlementDecimals ||
    readEnv('SETTLEMENT_TOKEN_SYMBOL') ||
    readEnv('SETTLEMENT_TOKEN_NAME') ||
    readEnv('MNEE_BASE_ADDRESS') ||
    readEnv('MNEE_BASE_DECIMALS'),
);

if (settlementConfigured) {
    if (!settlementAddress) {
        pushError('Settlement token config is partially configured; missing SETTLEMENT_TOKEN_ADDRESS or MNEE_BASE_ADDRESS');
    }
    if (!settlementDecimals) {
        pushError('Settlement token config is partially configured; missing SETTLEMENT_TOKEN_DECIMALS or MNEE_BASE_DECIMALS');
    }
}

validatePositiveInteger('SETTLEMENT_TOKEN_DECIMALS');
validatePositiveInteger('MNEE_BASE_DECIMALS');
validatePositiveInteger('COMMERCE_PAYMENTS_FEE_BPS');

for (const message of warnings) {
    logger.warn(message);
}

if (errors.length) {
    throw new Error(errors.join('\n'));
}

export const env = {
    DATABASE_URL: DATABASE_URL!,
    ALCHEMY_API_KEY: ALCHEMY_API_KEY!,
    CRON_SECRET: readEnv('CRON_SECRET') || '',
    FRONTEND_URL: readEnv('NEXT_PUBLIC_FRONTEND_URL') || 'http://localhost:3000',
    APP_URL: readEnv('NEXT_PUBLIC_APP_URL') || 'http://localhost:3000',
    API_URL: readEnv('NEXT_PUBLIC_API_URL') || 'http://localhost:3001',
    NODE_ENV,
    CHAIN_ENV,
    PRIVY_APP_ID: readEnv('PRIVY_APP_ID') || '',
    PRIVY_APP_SECRET: readEnv('PRIVY_APP_SECRET') || '',
} as const;
