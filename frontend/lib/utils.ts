export function cn(...classes: (string | undefined | false | null)[]): string {
    return classes.filter(Boolean).join(' ');
}

type AmountInput = number | string | bigint | null | undefined;

interface FormatAmountOptions {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
}

function toFiniteNumber(value: AmountInput): number | null {
    if (value === null || value === undefined || value === '') return null;

    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'bigint') {
        return Number(value);
    }

    const parsed = Number(String(value).trim());
    return Number.isFinite(parsed) ? parsed : null;
}

export function parseAmountInput(value: AmountInput): number | null {
    const parsed = toFiniteNumber(value);
    return parsed !== null && parsed >= 0 ? parsed : null;
}

export function formatAmount(value: AmountInput, options: FormatAmountOptions = {}): string {
    const parsed = toFiniteNumber(value);
    if (parsed === null) return '0';

    const formatter = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: options.minimumFractionDigits ?? 0,
        maximumFractionDigits: options.maximumFractionDigits ?? 2,
    });

    return formatter.format(parsed);
}

export function formatAmountWithSymbol(
    value: AmountInput,
    symbol: string,
    options: FormatAmountOptions = {},
): string {
    return `${formatAmount(value, options)} ${symbol}`.trim();
}
