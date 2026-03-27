const COAL_API_URL = process.env.COAL_API_URL || 'https://api.usecoal.xyz';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return Response.json({ error: 'sessionId required' }, { status: 400 });
  }

  try {
    const res = await fetch(`${COAL_API_URL}/api/pay/status/${sessionId}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      return Response.json({ status: 'unknown', error: `${res.status}` }, { status: 200 });
    }

    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json({ status: 'unknown', error: 'Failed to check status' }, { status: 200 });
  }
}
