import { sendUsdc, getUsdcBalance } from '@/lib/wallet';
import { confirmPayment } from '@/lib/coal-api';

const rateLimitMap = new Map<string, number[]>();
const MAX_PER_MINUTE = 10;

function checkRateLimit(): boolean {
  const key = 'agent-pay';
  const now = Date.now();
  const window = rateLimitMap.get(key) || [];
  const recent = window.filter((t) => now - t < 60_000);
  if (recent.length >= MAX_PER_MINUTE) return false;
  recent.push(now);
  rateLimitMap.set(key, recent);
  return true;
}

export async function POST(req: Request) {
  try {
    if (!checkRateLimit()) {
      return Response.json({ error: 'Rate limited — max 10 payments per minute' }, { status: 429 });
    }

    const body = await req.json();
    const { sessionId, amount, recipient, purpose } = body as {
      sessionId: string;
      amount: number;
      recipient: string;
      purpose: string;
    };

    if (!sessionId || !recipient || !amount) {
      return Response.json({ error: 'Missing sessionId, amount, or recipient' }, { status: 400 });
    }
    if (typeof amount !== 'number' || amount <= 0 || amount > 5) {
      return Response.json({ error: 'Amount must be between $0.01 and $5.00' }, { status: 400 });
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
      return Response.json({ error: 'Invalid recipient address' }, { status: 400 });
    }

    // Send USDC on Base
    const result = await sendUsdc(recipient, amount);

    // Confirm with Coal backend
    await confirmPayment(sessionId, result.txHash, result.from);

    return Response.json({
      success: true,
      txHash: result.txHash,
      amount: result.amount,
      recipient: result.to,
      from: result.from,
      purpose,
      basescanUrl: `https://basescan.org/tx/${result.txHash}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Payment failed';
    return Response.json({ error: message }, { status: 500 });
  }
}
