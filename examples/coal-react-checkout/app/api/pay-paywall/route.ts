import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { paywallId, address, txHash } = body as {
    paywallId?: string;
    address?: string;
    txHash?: string;
  };

  if (!paywallId || !txHash) {
    return NextResponse.json({ error: 'paywallId and txHash are required' }, { status: 400 });
  }

  const apiUrl = process.env.COAL_API_URL || 'https://api.usecoal.xyz';
  const apiKey = process.env.COAL_API_KEY;

  const res = await fetch(`${apiUrl}/api/paywalls/${encodeURIComponent(paywallId)}/pay`, {
    method: 'POST',
    headers: {
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ address, txHash }),
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
