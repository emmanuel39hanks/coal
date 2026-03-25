import { NextResponse } from 'next/server';
import { processDueSubscriptions } from '@/lib/subscriptions';

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = await processDueSubscriptions();
  return NextResponse.json(results);
}
