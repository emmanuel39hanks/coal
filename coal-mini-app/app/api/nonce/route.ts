import { NextResponse } from 'next/server';
import { mintNonce } from '@/lib/nonces';

export const runtime = 'nodejs';

export async function GET() {
    const nonce = mintNonce();
    return NextResponse.json({ nonce });
}
