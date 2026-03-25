import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

  const apiUrl = process.env.COAL_API_URL || 'https://api.usecoal.xyz';
  const apiKey = process.env.COAL_API_KEY;

  if (!apiKey) return NextResponse.json({ error: 'COAL_API_KEY not configured' }, { status: 500 });

  const res = await fetch(`${apiUrl}/api/checkout/${encodeURIComponent(sessionId)}`, {
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
  });

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
