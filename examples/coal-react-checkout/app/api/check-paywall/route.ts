import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const address = searchParams.get('address');

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const apiUrl = process.env.COAL_API_URL || 'https://api.usecoal.xyz';
  const apiKey = process.env.COAL_API_KEY;

  const params = new URLSearchParams();
  if (address) params.set('address', address);

  const res = await fetch(
    `${apiUrl}/api/paywalls/${encodeURIComponent(id)}/verify?${params.toString()}`,
    {
      headers: {
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
        'Content-Type': 'application/json',
      },
    }
  );

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
