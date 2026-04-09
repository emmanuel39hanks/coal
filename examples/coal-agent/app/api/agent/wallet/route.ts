import { getUsdcBalance, getOrCreateUserWallet, getWalletById } from '@/lib/wallet';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletId = searchParams.get('walletId');
    const address = searchParams.get('address');

    // If client provides a walletId, use that wallet
    if (walletId) {
      try {
        const wallet = await getWalletById(walletId);
        const balance = await getUsdcBalance(wallet.address);
        return Response.json({ ...balance, walletId, network: 'base' });
      } catch {
        // Wallet not found — fall through to create
      }
    }

    // If client provides an address (from localStorage), just check balance
    if (address) {
      const balance = await getUsdcBalance(address);
      return Response.json({ ...balance, walletId: walletId || null, network: 'base' });
    }

    // No wallet provided — return empty state, client should POST to create
    return Response.json({ address: null, balance: '0', walletId: null, network: 'base' });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to get wallet' },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const wallet = await getOrCreateUserWallet(`session_${Date.now()}`);
    const balance = await getUsdcBalance(wallet.address);
    return Response.json({ ...balance, walletId: wallet.walletId, network: 'base' });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to create wallet' },
      { status: 500 },
    );
  }
}
