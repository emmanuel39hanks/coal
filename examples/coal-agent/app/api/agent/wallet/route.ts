import { getUsdcBalance } from '@/lib/wallet';

export async function GET() {
  try {
    const wallet = await getUsdcBalance();
    return Response.json({ ...wallet, network: 'base' });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to get wallet info' },
      { status: 500 },
    );
  }
}
