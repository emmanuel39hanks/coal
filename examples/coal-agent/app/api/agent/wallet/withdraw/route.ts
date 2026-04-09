import { withdrawUsdc } from '@/lib/wallet';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { toAddress, walletId, amount } = body as { toAddress: string; walletId: string; amount?: number };

    if (!toAddress || !/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
      return Response.json({ error: 'Invalid destination address' }, { status: 400 });
    }
    if (!walletId) {
      return Response.json({ error: 'walletId required' }, { status: 400 });
    }

    const result = await withdrawUsdc(walletId, toAddress, amount);

    return Response.json({
      success: true,
      ...result,
      basescanUrl: `https://basescan.org/tx/${result.txHash}`,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Withdraw failed' },
      { status: 500 },
    );
  }
}
