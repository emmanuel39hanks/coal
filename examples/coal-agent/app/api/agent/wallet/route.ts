import { getUsdcBalance, getOrCreateUserWallet } from '@/lib/wallet';
import { cookies } from 'next/headers';

async function getWalletForSession(): Promise<{ walletId: string; address: string }> {
  const cookieStore = await cookies();
  const walletId = cookieStore.get('agent_wallet_id')?.value;
  const walletAddr = cookieStore.get('agent_wallet_addr')?.value;

  if (walletId && walletAddr) {
    return { walletId, address: walletAddr };
  }

  // Create a new wallet for this session
  const wallet = await getOrCreateUserWallet(`session_${Date.now()}`);
  return wallet;
}

export async function GET() {
  try {
    const wallet = await getWalletForSession();
    const balance = await getUsdcBalance(wallet.address);

    // Set cookies for session persistence
    const response = Response.json({
      ...balance,
      walletId: wallet.walletId,
      network: 'base',
    });

    return response;
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to get wallet' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    // Create/get wallet and return it — client stores walletId
    const wallet = await getOrCreateUserWallet(`session_${Date.now()}`);
    const balance = await getUsdcBalance(wallet.address);

    return Response.json({
      ...balance,
      walletId: wallet.walletId,
      network: 'base',
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to create wallet' },
      { status: 500 },
    );
  }
}
