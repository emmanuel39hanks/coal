import { NextResponse } from 'next/server';
import { verifySiweMessage } from '@worldcoin/minikit-js';
import { consumeNonce } from '@/lib/nonces';

export const runtime = 'nodejs';

/**
 * Verify a SIWE signature produced by MiniKit.commandsAsync.walletAuth.
 *
 * The Mini App calls walletAuth, gets back { status, message, signature,
 * address }, and POSTs the payload here with the nonce we issued at
 * /api/nonce. We verify the signature against the message and ensure
 * the message's nonce matches what we minted.
 */
export async function POST(req: Request) {
    try {
        const { payload, nonce } = (await req.json()) as {
            payload: {
                status: 'success' | 'error';
                message?: string;
                signature?: string;
                address?: string;
                version?: number;
            };
            nonce: string;
        };

        if (!payload || payload.status !== 'success') {
            return NextResponse.json({ ok: false, error: 'Bad payload' }, { status: 400 });
        }
        if (!nonce || !consumeNonce(nonce)) {
            return NextResponse.json({ ok: false, error: 'Invalid or expired nonce' }, { status: 400 });
        }

        const verified = await verifySiweMessage(payload as Parameters<typeof verifySiweMessage>[0], nonce);
        if (!verified.isValid) {
            return NextResponse.json({ ok: false, error: 'SIWE signature invalid' }, { status: 401 });
        }

        // For the hackathon we don't create a long-lived session cookie.
        // The client trusts the verified address returned here and
        // re-authenticates on next open.
        return NextResponse.json({
            ok: true,
            address: (payload.address || '').toLowerCase(),
        });
    } catch (err) {
        console.error('[coal-mini-app] SIWE verify failed', err);
        return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
    }
}
