import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { txHash } = body;

        if (!txHash) {
            return NextResponse.json({ error: 'Missing txHash' }, { status: 400 });
        }

        console.log(`[Checkout] Payment confirmed: ${txHash}`);

        // TODO: In a real app complexity:
        // 1. Wait for confirmations
        // 2. Decode the logs to verify amount/recipient
        // 3. Mark order as paid in DB

        return NextResponse.json({
            status: 'confirmed',
            message: 'Payment verified successfully'
        });

    } catch (error) {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
