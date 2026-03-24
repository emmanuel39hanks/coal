import { z } from 'zod';

export const PAYER_INFO_FIELDS = ['fullName', 'email', 'phone', 'company', 'country'] as const;
export type PayerInfoField = typeof PAYER_INFO_FIELDS[number];

export const payerInfoFieldSchema = z.enum(PAYER_INFO_FIELDS);

export const payerInfoConfigSchema = z.object({
  required: z.boolean().default(false),
  fields: z.array(payerInfoFieldSchema).max(PAYER_INFO_FIELDS.length).default([]),
}).transform((value) => ({
  required: value.required,
  fields: Array.from(new Set(value.fields)),
}));

export const payerInfoValuesSchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email('Must be a valid email').optional(),
  phone: z.string().trim().min(3).max(40).optional(),
  company: z.string().trim().min(1).max(120).optional(),
  country: z.string().trim().min(2).max(80).optional(),
}).partial();

export type PayerInfoConfig = z.infer<typeof payerInfoConfigSchema>;
export type PayerInfoValues = z.infer<typeof payerInfoValuesSchema>;

export function normalizePayerInfoConfig(config?: unknown): PayerInfoConfig | null {
  const parsed = payerInfoConfigSchema.safeParse(config);
  if (!parsed.success || parsed.data.fields.length === 0) {
    return null;
  }
  return parsed.data;
}

export function normalizePayerInfoValues(values?: unknown): PayerInfoValues | null {
  if (!values || typeof values !== 'object') return null;

  const sanitized = Object.fromEntries(
    Object.entries(values as Record<string, unknown>).flatMap(([key, value]) => {
      if (typeof value !== 'string') return [];
      const trimmed = value.trim();
      return trimmed.length > 0 ? [[key, trimmed]] : [];
    }),
  );

  const parsed = payerInfoValuesSchema.safeParse(sanitized);
  if (!parsed.success) return null;
  return Object.keys(parsed.data).length > 0 ? parsed.data : null;
}

export function validatePayerInfo(config: PayerInfoConfig | null, values: PayerInfoValues | null) {
  if (!config || config.fields.length === 0) {
    return { ok: true as const, normalized: null as PayerInfoValues | null };
  }

  const normalized = normalizePayerInfoValues(values);
  const issues: Record<string, string[]> = {};

  if (config.required) {
    for (const field of config.fields) {
      const value = normalized?.[field];
      if (!value) {
        issues[field] = ['This field is required'];
      }
    }
  }

  if (!normalized && Object.keys(issues).length === 0) {
    return { ok: true as const, normalized: null as PayerInfoValues | null };
  }

  if (values) {
    const parsed = payerInfoValuesSchema.safeParse(values);
    if (!parsed.success) {
      const flattened = parsed.error.flatten().fieldErrors;
      for (const [field, messages] of Object.entries(flattened)) {
        if (messages && messages.length > 0) {
          issues[field] = messages;
        }
      }
    }
  }

  const allowedSet = new Set(config.fields);
  for (const key of Object.keys(normalized || {})) {
    if (!allowedSet.has(key as PayerInfoField)) {
      issues[key] = ['This field is not enabled for this checkout'];
    }
  }

  if (Object.keys(issues).length > 0) {
    return { ok: false as const, errors: issues };
  }

  return { ok: true as const, normalized };
}
