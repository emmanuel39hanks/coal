import { isAddress } from 'viem';

export interface SplitRecipient {
  address: string;
  percent: number;
  label?: string;
}

// Validate split recipients array
export function validateRecipients(recipients: SplitRecipient[]): string | null {
  if (!Array.isArray(recipients) || recipients.length === 0) return 'Recipients required';
  if (recipients.length > 10) return 'Maximum 10 recipients';
  for (const r of recipients) {
    if (!isAddress(r.address)) return `Invalid address: ${r.address}`;
    if (r.percent < 1) return 'Minimum split is 1%';
    if (r.percent > 99) return 'Maximum split per recipient is 99%';
  }
  const total = recipients.reduce((sum, r) => sum + r.percent, 0);
  if (total !== 100) return `Percentages must sum to 100 (got ${total})`;
  return null;
}

// Calculate split amounts from a total, with remainder going to first recipient
export function calculateSplitAmounts(
  totalAmount: bigint,
  recipients: SplitRecipient[]
): Array<{ address: string; label?: string; amount: bigint; percent: number }> {
  const results = recipients.map(r => ({
    address: r.address,
    label: r.label,
    percent: r.percent,
    amount: (totalAmount * BigInt(r.percent)) / BigInt(100),
  }));

  // Remainder due to integer division goes to first recipient
  const distributed = results.reduce((sum, r) => sum + r.amount, BigInt(0));
  const remainder = totalAmount - distributed;
  if (remainder > BigInt(0)) results[0].amount += remainder;

  return results;
}
