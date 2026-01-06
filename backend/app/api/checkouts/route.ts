import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/api-auth';

/**
 * POST /api/checkouts - Create a new checkout session
 * 
 * This is the main API endpoint for merchants to create checkout sessions programmatically.
 * Requires x-api-key header with a valid Coal API key.
 */
export async function POST(request: Request) {
    try {
        // 1. Authenticate API Key
        const keyRecord = await validateApiKey(request);
        if (!keyRecord) {
            return NextResponse.json(
                { error: 'Unauthorized: Invalid or missing API Key' },
                { status: 401 }
            );
        }

        const merchant = keyRecord.merchant;

        // 2. Parse and validate body
        const body = await request.json();
        const {
            amount,
            currency,
            // Product metadata
            productId,
            productName,
            productDescription,
            productImage,
            // Other options
            description,
            redirectUrl,
            callbackUrl,
            splits
        } = body;

        if (!amount || isNaN(parseFloat(amount))) {
            return NextResponse.json(
                { error: 'Invalid or missing amount' },
                { status: 400 }
            );
        }

        // 3. Create Checkout Session
        // Store product metadata in the splits JSON field for now (or we can add a metadata column later)
        const session = await prisma.checkoutSession.create({
            data: {
                merchantId: merchant.id,
                amount: parseFloat(amount),
                currency: currency || "MNEE",
                status: 'pending',
                // Use product name as description, or fallback to provided description
                description: productName || description || "Coal Checkout",
                // Store product info in splits field as workaround (it's Json type)
                // In production, we'd add a proper metadata field
                splits: {
                    productId: productId || null,
                    productName: productName || null,
                    productDescription: productDescription || null,
                    productImage: productImage || null,
                },
                redirectUrl: redirectUrl || null,
                callbackUrl: callbackUrl || null,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            }
        });

        // 4. Generate checkout URL
        const baseUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
        const checkoutUrl = `${baseUrl}/pay/${session.id}`;

        console.log(`✅ Checkout created: ${session.id} | ${productName || 'No product'} | ${amount} ${currency || 'MNEE'}`);

        return NextResponse.json({
            id: session.id,
            url: checkoutUrl,
            status: session.status,
            amount: session.amount,
            currency: session.currency,
            productName: productName || null,
            expiresAt: session.expiresAt
        });

    } catch (error) {
        console.error("Checkout API Error:", error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
