
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const signature = request.headers.get('Coal-Signature');

        console.log("⚡️ [Demo Store] Webhook Received!");
        console.log("📝 Signature:", signature);
        console.log("📦 Body:", JSON.stringify(body, null, 2));

        if (body.event === 'checkout.session.completed') {
            console.log("✅ Payment Confirmed for:", body.data.amount, body.data.currency);
            // In a real app, update order status here
        }

        return NextResponse.json({ received: true });
    } catch (e) {
        console.error("Webhook Error", e);
        return NextResponse.json({ error: "Webhook Failed" }, { status: 500 });
    }
}
