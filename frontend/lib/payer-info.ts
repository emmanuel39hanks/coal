export const PAYER_INFO_FIELDS = ['fullName', 'email', 'phone', 'company', 'country'] as const;
export type PayerInfoField = typeof PAYER_INFO_FIELDS[number];

export type PayerInfoConfig = {
  required: boolean;
  fields: PayerInfoField[];
} | null;

export type PayerInfoValues = Partial<Record<PayerInfoField, string>>;

export const PAYER_INFO_FIELD_META: Record<PayerInfoField, {
  label: string;
  placeholder: string;
  type: 'text' | 'email' | 'tel';
}> = {
  fullName: {
    label: 'Full name',
    placeholder: 'Ada Lovelace',
    type: 'text',
  },
  email: {
    label: 'Email address',
    placeholder: 'ada@example.com',
    type: 'email',
  },
  phone: {
    label: 'Phone number',
    placeholder: '+260 97 000 0000',
    type: 'tel',
  },
  company: {
    label: 'Company',
    placeholder: 'Schema Labs',
    type: 'text',
  },
  country: {
    label: 'Country',
    placeholder: 'Zambia',
    type: 'text',
  },
};

export function normalizePayerInfoConfig(value: unknown): PayerInfoConfig {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { required?: unknown; fields?: unknown };
  const fields = Array.isArray(candidate.fields)
    ? candidate.fields.filter((field): field is PayerInfoField => PAYER_INFO_FIELDS.includes(field as PayerInfoField))
    : [];

  if (fields.length === 0) return null;

  return {
    required: candidate.required === true,
    fields: Array.from(new Set(fields)),
  };
}

export function normalizePayerInfoValues(value: unknown): PayerInfoValues {
  if (!value || typeof value !== 'object') return {};
  const source = value as Record<string, unknown>;
  return PAYER_INFO_FIELDS.reduce((acc, field) => {
    const raw = source[field];
    if (typeof raw === 'string' && raw.trim().length > 0) {
      acc[field] = raw.trim();
    }
    return acc;
  }, {} as PayerInfoValues);
}

export function validatePayerInfo(config: PayerInfoConfig, values: PayerInfoValues) {
  if (!config) return {};

  return config.fields.reduce((errors, field) => {
    const value = values[field]?.trim() || '';
    if (config.required && !value) {
      errors[field] = 'Required';
      return errors;
    }

    if (!value) return errors;

    if (field === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors[field] = 'Enter a valid email';
    }

    return errors;
  }, {} as Partial<Record<PayerInfoField, string>>);
}
