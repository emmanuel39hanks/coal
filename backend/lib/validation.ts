import { parseUnits } from 'viem';

/**
 * Validates a monetary amount.
 *
 * Rules:
 * - Must be a positive finite number (rejects 0, negatives, NaN, Infinity)
 * - Maximum value: 1,000,000
 * - Maximum decimal places: 6 (USDC/ERC-20 compatible)
 * - Strings like "10abc" are rejected (Number("10abc") === NaN)
 *
 * @returns The parsed number, or null if invalid.
 */
export function validateAmount(value: unknown): number | null {
    const num = typeof value === 'string' ? Number(value) : value;

    if (typeof num !== 'number') return null;
    if (!Number.isFinite(num)) return null;   // Rejects NaN, Infinity, -Infinity
    if (num <= 0) return null;                // Rejects 0 and negatives
    if (num > 1_000_000) return null;         // Reasonable upper bound

    // Reject more than 6 decimal places
    const strVal = String(value);
    const dotIndex = strVal.indexOf('.');
    if (dotIndex !== -1 && strVal.length - dotIndex - 1 > 6) return null;

    return num;
}

/**
 * Compare an on-chain token amount (bigint) to an expected amount (string | number).
 * Uses parseUnits for the conversion — no floating-point math.
 *
 * @example
 *   amountsMatch(1000000000000000000n, "1.0", 18) // true  (1 MNEE)
 *   amountsMatch(1000000n,             "1.0",  6) // true  (1 USDC)
 *   amountsMatch(1000001n,             "1.0",  6) // false (off by 1 unit)
 */
export function amountsMatch(
    onChainAmount: bigint,
    expectedAmount: string | number,
    decimals: number
): boolean {
    try {
        const expectedStr = typeof expectedAmount === 'number'
            ? expectedAmount.toString()
            : expectedAmount;
        // Truncate to `decimals` places to avoid parseUnits errors
        const parts = expectedStr.split('.');
        const truncated = parts[1]
            ? `${parts[0]}.${parts[1].slice(0, decimals)}`
            : expectedStr;
        return onChainAmount === parseUnits(truncated, decimals);
    } catch {
        return false;
    }
}

/**
 * Convert a decimal amount into raw token units without floating-point math.
 *
 * This is the shared path for payment capture/refund math so we keep the
 * settlement token conversion consistent with the rest of the codebase.
 */
export function amountToRawUnits(
    value: string | number | bigint,
    decimals: number
): bigint {
    if (typeof value === 'bigint') return value;
    const normalized = typeof value === 'number' ? value.toString() : value.trim();
    return parseUnits(normalized, decimals);
}

/**
 * Validates an EVM wallet address.
 * Must be exactly 0x followed by 40 hex characters.
 *
 * @returns The address string (original casing), or null if invalid.
 */
export function validateAddress(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    if (!/^0x[a-fA-F0-9]{40}$/.test(value)) return null;
    return value;
}
