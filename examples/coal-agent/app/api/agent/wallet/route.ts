import { getUsdcBalance, createUserWallet, getWalletById } from '@/lib/wallet';

// Read paths are public — anyone can check a balance for any address.
// Write paths (POST = create wallet) issue a signed binding the client must
// echo back on every chat / payment request. See signWalletBinding().

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const walletId = searchParams.get('walletId');
    const address = searchParams.get('address');

    if (walletId) {
      try {
        const wallet = await getWalletById(walletId);
        const balance = await getUsdcBalance(wallet.address);
        return Response.json({ ...balance, walletId, network: 'base' });
      } catch {
        // Wallet not found — fall through to address-only check
      }
    }

    if (address) {
      const balance = await getUsdcBalance(address);
      return Response.json({ ...balance, walletId: walletId || null, network: 'base' });
    }

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
    const wallet = await createUserWallet();
    const balance = await getUsdcBalance(wallet.address);
    // The signature is the server's HMAC over (walletId|walletAddress). The
    // client stores it alongside walletId in localStorage and sends it back
    // on every chat / payment request — without it the server rejects payments.
    return Response.json({
      ...balance,
      walletId: wallet.walletId,
      walletSignature: wallet.signature,
      network: 'base',
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to create wallet' },
      { status: 500 },
    );
  }
}
