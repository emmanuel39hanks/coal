import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { amount, productName, productDescription, productId, callbackUrl, payerInfo } = body as {
    amount?: number;
    productName?: string;
    productDescription?: string;
    productId?: string;
    callbackUrl?: string;
    payerInfo?: { required: boolean; fields: string[] };
  };

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return NextResponse.json({ error: 'amount is required and must be a positive number' }, { status: 400 });
  }

  const apiKey = process.env.COAL_API_KEY;
  const apiUrl = process.env.COAL_API_URL || 'https://api.usecoal.xyz';

  if (!apiKey) {
    return NextResponse.json({ error: 'COAL_API_KEY env var is not set' }, { status: 500 });
  }

  const response = await fetch(`${apiUrl}/api/checkouts`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount,
      productName: productName || 'Checkout',
      productDescription: productDescription || undefined,
      productId: productId || undefined,
      callbackUrl: callbackUrl || undefined,
      payerInfo: payerInfo || undefined,
      redirectUrl: `${req.nextUrl.origin}/success`,
    }),
  });

  if (!response.ok) {
    let errMsg: string;
    const ct = response.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const j = await response.json();
      errMsg = j?.error?.message || j?.error || JSON.stringify(j);
    } else {
      errMsg = `Backend returned ${response.status}`;
    }
    return NextResponse.json({ error: errMsg }, { status: response.status });
  }

  const data = await response.json();
  const sessionId = data.data?.id ?? data.id;
  const checkoutUrl = data.data?.url ?? data.url ?? null;
  return NextResponse.json({ sessionId, checkoutUrl });
}
