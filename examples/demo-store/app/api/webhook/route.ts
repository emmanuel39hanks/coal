
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

            // Verify the receipt via Coal's public receipt endpoint
            const sessionId = body.data.sessionId;
            if (sessionId) {
                const COAL_API_URL = (process.env.COAL_API_URL || 'http://localhost:3001/api/checkouts').replace(/\/api\/checkouts$/, '');
                try {
                    const receiptRes = await fetch(`${COAL_API_URL}/api/receipts/${sessionId}`);
                    const receipt = await receiptRes.json();

                    console.log("🧾 [Receipt Verification]");
                    console.log("   Status:", receipt.verified ? "Verified" : "Pending");

                    if (receipt.proofTrail?.storage) {
                        console.log("   📦 0G Storage URI:", receipt.proofTrail.storage.storageUri);
                        console.log("   📦 Storage Tx:", receipt.proofTrail.storage.storageTxHash);
                    }

                    if (receipt.proofTrail?.chain) {
                        console.log("   ⛓️ 0G Chain Anchor Tx:", receipt.proofTrail.chain.anchorTxHash);
                        console.log("   ⛓️ Chain Explorer:", receipt.proofTrail.chain.explorerUrl);
                    }
                } catch (err) {
                    console.warn("⚠️ Receipt verification fetch failed:", err);
                }
            }
        }

        return NextResponse.json({ received: true });
    } catch (e) {
        console.error("Webhook Error", e);
        return NextResponse.json({ error: "Webhook Failed" }, { status: 500 });
    }
}
