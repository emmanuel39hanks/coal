import { withdrawUsdc, verifyWalletBinding } from '@/lib/wallet';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { toAddress, walletId, walletAddress, walletSignature, amount } = body as {
      toAddress: string;
      walletId: string;
      walletAddress: string;
      walletSignature: string;
      amount?: number;
    };

    if (!toAddress || !/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
      return Response.json({ error: 'Invalid destination address' }, { status: 400 });
    }
    if (!walletId || !walletAddress || !walletSignature) {
      return Response.json(
        { error: 'walletId, walletAddress, and walletSignature required' },
        { status: 400 },
      );
    }
    if (!verifyWalletBinding(walletId, walletAddress, walletSignature)) {
      return Response.json(
        { error: 'Invalid wallet signature. Refresh the page to mint a fresh binding.' },
        { status: 401 },
      );
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
