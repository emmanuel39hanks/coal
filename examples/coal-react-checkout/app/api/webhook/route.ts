import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { addEvent, getEvents } from '../_store';

function verifySignature(payload: string, signature: string, secret: string): boolean {
  try {
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    if (signature.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-coal-signature') || '';
  const secret = process.env.COAL_WEBHOOK_SECRET || '';

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Accept test events (signature === 'test') when no secret is configured
  const isValid = secret
    ? verifySignature(rawBody, signature, secret)
    : signature === 'test';

  const type = (payload as any)?.type || 'unknown';

  const event = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    receivedAt: new Date().toISOString(),
    valid: isValid,
    payload,
  };

  addEvent(event);
  return NextResponse.json({ received: true, id: event.id });
}

// Also expose GET so the events page can poll /api/webhook directly
export async function GET() {
  return NextResponse.json({ events: getEvents() });
}
