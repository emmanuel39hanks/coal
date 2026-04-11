import { z } from 'zod';
import { NextResponse } from 'next/server';
import { payerInfoConfigSchema, payerInfoValuesSchema } from '@/lib/payer-info';
import { getSettlementToken } from '@/lib/chain';

// ─── Reusable primitives ──────────────────────────────────────────────────────
export const evmAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address');
export const txHashField = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash');
export const amountField = z.coerce
    .number({ error: 'Amount must be a number' })
    .positive('Amount must be positive')
    .finite('Amount must be finite')
    .max(1_000_000, 'Amount must not exceed 1,000,000')
    .refine(v => {
        const parts = String(v).split('.');
        return !parts[1] || parts[1].length <= 6;
    }, 'Amount must have at most 6 decimal places');

const optionalUrl = z.string().url('Must be a valid URL').optional().or(z.literal(''));
const optionalEmail = z.string().email('Must be a valid email').optional().or(z.literal(''));
const billingTypeField = z.enum(['one_time', 'subscription']).default('one_time');
const billingIntervalField = z.enum(['day', 'week', 'month', 'year']).optional();
const SUPPORTED_CHECKOUT_CURRENCIES = Array.from(
    new Set([getSettlementToken().symbol.toUpperCase(), 'USDC', 'ETH']),
);
const checkoutCurrencyField = z
    .string()
    .trim()
    .min(2, 'Currency must be at least 2 characters')
    .max(16, 'Currency must be 16 characters or fewer')
    .regex(/^[A-Za-z0-9_-]+$/, 'Currency must be alphanumeric')
    .optional()
    .transform((value) => (value ?? getSettlementToken().symbol).toUpperCase())
    .refine(
        (value) => SUPPORTED_CHECKOUT_CURRENCIES.includes(value),
        `Unsupported currency. Supported values: ${SUPPORTED_CHECKOUT_CURRENCIES.join(', ')}`,
    );

// ─── Checkout API ─────────────────────────────────────────────────────────────
export const createCheckoutSchema = z.object({
    amount: amountField,
    currency: checkoutCurrencyField,
    productId: z.string().optional(),
    productName: z.string().max(200).optional(),
    productDescription: z.string().max(2000).optional(),
    productImage: optionalUrl,
    description: z.string().max(500).optional(),
    redirectUrl: optionalUrl,
    callbackUrl: optionalUrl,
    metadata: z.record(z.string(), z.unknown()).optional().refine(
        (val) => !val || JSON.stringify(val).length <= 4096,
        'Metadata must be 4KB or less when serialized',
    ),
    splitConfigId: z.string().optional(),
    payerInfo: payerInfoConfigSchema.optional(),
});

// ─── Payment Confirm ──────────────────────────────────────────────────────────
export const confirmPaymentSchema = z.object({
    sessionId: z.string().min(1, 'Session ID required'),
    txHash: txHashField,
    fundingIntentId: z.string().optional(),
    signature: z.string().optional(), // EIP-712 (Task 13 — optional for now)
    payerAddress: evmAddress.optional(),
    customerEmail: optionalEmail,
    subscriptionConsentAccepted: z.boolean().optional(),
    payerInfo: payerInfoValuesSchema.optional(),
});

// ─── Payment Session ──────────────────────────────────────────────────────────
export const createSessionSchema = z.object({
    linkId: z.string().min(1, 'Link ID required'),
    amount: amountField.optional(),
    customerEmail: optionalEmail,
    subscriptionConsentAccepted: z.boolean().optional(),
    payerInfo: payerInfoValuesSchema.optional(),
});

// ─── Console Products ─────────────────────────────────────────────────────────
export const createProductSchema = z.object({
    name: z.string().min(1, 'Name required').max(200),
    description: z.string().max(2000).optional(),
    price: amountField,
    image: optionalUrl,
    billingType: billingTypeField,
    billingInterval: billingIntervalField,
    billingIntervalCount: z.coerce.number().int().min(1).max(12).optional(),
    sku: z.string().max(100).optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
    status: z.enum(['draft', 'active', 'archived']).optional(),
    images: z.array(z.string().url()).max(6).optional(),
}).superRefine((data, ctx) => {
    if (data.billingType === 'subscription' && !data.billingInterval) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['billingInterval'],
            message: 'Billing interval is required for subscription products',
        });
    }
});

export const updateProductSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    price: amountField.optional(),
    image: optionalUrl,
    billingType: billingTypeField.optional(),
    billingInterval: billingIntervalField.or(z.literal('')).optional(),
    billingIntervalCount: z.coerce.number().int().min(1).max(12).optional(),
    sku: z.string().max(100).optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
    status: z.enum(['draft', 'active', 'archived']).optional(),
    images: z.array(z.string().url()).max(6).optional(),
}).superRefine((data, ctx) => {
    const billingType = data.billingType;
    const billingInterval =
        data.billingInterval === ''
            ? undefined
            : data.billingInterval;

    if (billingType === 'subscription' && !billingInterval) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['billingInterval'],
            message: 'Billing interval is required for subscription products',
        });
    }
});

// ─── Console Links ────────────────────────────────────────────────────────────
export const createLinkSchema = z.object({
    productId: z.string().optional(),
    slug: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/, 'Slug must be alphanumeric, hyphens or underscores').optional(),
    title: z.string().max(200).optional(),
    description: z.string().max(500).optional(),
    payerInfo: payerInfoConfigSchema.optional(),
    expiresAt: z.coerce.date().optional().refine(d => !d || d > new Date(), { message: 'Expiration must be in the future' }),
    maxUses: z.coerce.number().int().positive().optional(),
    redirectUrl: z.string().url().optional().or(z.literal('')),
    allowQuantity: z.boolean().optional(),
    minQuantity: z.coerce.number().int().min(1).max(100).optional(),
    maxQuantity: z.coerce.number().int().min(1).max(100).optional(),
});

export const updateLinkSchema = z.object({
    productId: z.string().optional(),
    slug: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/, 'Slug must be alphanumeric, hyphens or underscores').optional(),
    title: z.string().max(200).optional(),
    description: z.string().max(500).optional(),
    payerInfo: payerInfoConfigSchema.optional(),
    expiresAt: z.coerce.date().optional().refine(d => !d || d > new Date(), { message: 'Expiration must be in the future' }),
    maxUses: z.coerce.number().int().positive().optional(),
    redirectUrl: z.string().url().optional().or(z.literal('')),
    allowQuantity: z.boolean().optional(),
    minQuantity: z.coerce.number().int().min(1).max(100).optional(),
    maxQuantity: z.coerce.number().int().min(1).max(100).optional(),
    active: z.boolean().optional(),
});

export const savePayerInfoSchema = z.object({
    sessionId: z.string().min(1, 'Session ID required'),
    payerInfo: payerInfoValuesSchema,
});

export const createFundingIntentSchema = z.object({
    sessionId: z.string().min(1, 'Session ID required'),
    walletAddress: evmAddress.optional(),
    fundingMode: z.enum(['embedded', 'external']).optional(),
});

// ─── Console Keys ─────────────────────────────────────────────────────────────
export const createKeySchema = z.object({
    name: z.string().max(100).optional(),
});

// ─── Agent Catalog Publish ───────────────────────────────────────────────────
// Used by merchants whose product catalog lives OUTSIDE Coal's console (their
// own DB, Shopify, Sanity, etc.) to push products into Coal for agent discovery.
// Each product is upserted keyed by (merchantId, externalId) so the same call
// can be replayed safely.
export const publishCatalogProductSchema = z.object({
    externalId: z.string().min(1, 'externalId is required').max(128),
    name: z.string().min(1, 'name is required').max(200),
    description: z.string().max(2000).optional(),
    price: amountField,
    image: optionalUrl,
    images: z.array(z.string().url()).max(6).optional(),
    sku: z.string().max(100).optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
    billingType: billingTypeField.optional(),
    billingInterval: billingIntervalField.optional(),
    billingIntervalCount: z.coerce.number().int().min(1).max(12).optional(),
});

export const publishCatalogSchema = z.object({
    products: z.array(publishCatalogProductSchema)
        .min(1, 'At least one product is required')
        .max(500, 'Maximum 500 products per publish'),
    // upsert (default): only touch products listed in the payload.
    // replace: also deactivate any existing external products not in the payload.
    mode: z.enum(['upsert', 'replace']).default('upsert'),
});

// ─── Console Paywalls ────────────────────────────────────────────────────────
export const createPaywallSchema = z.object({
    name: z.string().min(1, 'Name required').max(200),
    price: amountField,
    currency: z.string().default('USDC'),
    description: z.string().max(2000).optional(),
    contentType: z.string().default('api'),
    contentData: z.record(z.string(), z.unknown()).optional(),
    contentUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
    pricingModel: z.string().default('one_time'),
    accessDuration: z.coerce.number().int().positive().optional(),
    callQuota: z.coerce.number().int().positive().optional(),
});

export const updatePaywallSchema = z.object({
    name:           z.string().min(1).max(200).optional(),
    description:    z.string().max(2000).optional(),
    price:          amountField.optional(),
    contentData:    z.record(z.string(), z.unknown()).optional(),
    contentUrl:     z.string().url('Must be a valid URL').optional().or(z.literal('')),
    active:         z.boolean().optional(),
    pricingModel:   z.string().optional(),
    accessDuration: z.coerce.number().int().positive().optional().or(z.literal(null)),
    callQuota:      z.coerce.number().int().positive().optional().or(z.literal(null)),
});

// ─── Console Settings ─────────────────────────────────────────────────────────
export const updateSettingsSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    payoutAddress: evmAddress.optional().or(z.literal('')).transform(v => v || undefined),
    webhookUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')).or(z.null()).transform(v => v || undefined),
});

// ─── Console Subscriptions ────────────────────────────────────────────────────
export const updateSubscriptionSchema = z.object({
    action: z.enum(['pause', 'resume', 'cancel']),
});

// ─── Validation helper ────────────────────────────────────────────────────────
export function validateBody<T>(
    schema: z.ZodSchema<T>,
    body: unknown
): { success: true; data: T } | { success: false; error: NextResponse } {
    const result = schema.safeParse(body);
    if (!result.success) {
        return {
            success: false,
            error: NextResponse.json(
                {
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Validation failed',
                        details: result.error.flatten().fieldErrors,
                    }
                },
                { status: 400 }
            ),
        };
    }
    return { success: true, data: result.data };
}
