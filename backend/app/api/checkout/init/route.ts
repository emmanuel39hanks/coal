import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { productId } = body;

        // Mock lookup - in real app, fetch from DB
        const mockProduct = {
            id: productId,
            price: "50000", // 0.5 MNEE in atomic units (100,000 atomic = 1 MNEE)
            name: "Fake Product"
        };

        // Hardcoded payout wallet for MVP (Ethereum / EVM)
        const payoutWallet = "0xfD6dC00c77C80E46aa01acF440b87baB8FdB772a"; // Example ETH Merchant Address

        return NextResponse.json({
            to: payoutWallet,
            amount: 0.01, // Low amount for testing
            amountAtomic: 10000,
            token: "MNEE",
            productId: mockProduct.id,
            description: mockProduct.name
        });

    } catch (error) {
        return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
}
