/**
 * OracleAgent — Price Data API
 *
 * GET /api/price/:symbol
 *
 * Returns real-time price data for any crypto token or stock ticker.
 * Protected by Coal's x402 paywall at $0.01 per call.
 *
 * Flow:
 * 1. Agent hits GET /api/price/eth
 * 2. Server checks Coal's paywall: has this address paid?
 * 3. No  → returns 402 with x402 payment headers
 * 4. Yes → fetches price from CoinGecko/Yahoo → returns data
 *
 * Supported symbols:
 * - Crypto: eth, btc, sol, usdc, bnb, xrp, ada, doge, link, uni, near, 0g, ...
 * - Stocks: AAPL, MSFT, TSLA, GOOGL, AMZN, NVDA, META, ...
 */

import { getPrice } from '@/lib/prices';

const PAYWALL_ID = process.env.PAYWALL_ID || 'pw_oracle_price_feed';
const COAL_API_URL = process.env.COAL_API_URL || 'https://api.usecoal.xyz';
const MERCHANT_PAYOUT = process.env.MERCHANT_PAYOUT_ADDRESS || '0x83d412b9dc65fc728455a1AFE00cE8812CdCce13';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ symbol: string }> },
) {
    const { symbol } = await params;

    if (!symbol || symbol.length > 10) {
        return Response.json(
            { error: 'Invalid symbol. Use a crypto ticker (eth, btc, sol) or stock ticker (AAPL, MSFT).' },
            { status: 400 },
        );
    }

    // ── Check if the caller has paid via Coal's paywall ──────────────────
    const url = new URL(request.url);
    const callerAddress = url.searchParams.get('address');

    if (!callerAddress) {
        const verifyUrl = `${COAL_API_URL}/api/paywalls/${PAYWALL_ID}/verify`;
        const resourceUrl = `${url.origin}/api/price/${symbol}`;
        // x402 standard 402 response — `accepts` array lets any x402 client pay
        return new Response(
            JSON.stringify({
                x402Version: 1,
                accepts: [
                    {
                        scheme: 'exact',
                        network: 'eip155:8453',
                        maxAmountRequired: '10000', // 0.01 USDC in base units (6 decimals)
                        asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
                        payTo: MERCHANT_PAYOUT,
                        resource: resourceUrl,
                        description: `Price data for ${symbol.toUpperCase()}`,
                        mimeType: 'application/json',
                        maxTimeoutSeconds: 60,
                        extra: { name: 'USD Coin', version: '2' },
                        verifyUrl,
                    },
                ],
                error: 'Payment required',
                message: `Price data for ${symbol.toUpperCase()} costs $0.01 per call. POST X-PAYMENT to verifyUrl per x402, then retry with ?address=YOUR_WALLET.`,
                paywall: {
                    id: PAYWALL_ID,
                    price: '0.01',
                    currency: 'USDC',
                    network: 'base',
                    pricingModel: 'per_call',
                    payTo: MERCHANT_PAYOUT,
                    verifyUrl,
                },
            }),
            {
                status: 402,
                headers: {
                    'content-type': 'application/json',
                    'x-payment-required': 'true',
                    'x-payment-amount': '0.01',
                    'x-payment-currency': 'USDC',
                    'x-payment-network': 'base',
                    'x-payment-address': MERCHANT_PAYOUT,
                    'x-payment-verify': verifyUrl,
                },
            },
        );
    }

    // Check if the address has paid via Coal's paywall verify endpoint
    try {
        const verifyRes = await fetch(
            `${COAL_API_URL}/api/paywalls/${PAYWALL_ID}/verify?address=${encodeURIComponent(callerAddress)}`,
            { headers: { accept: 'application/json' } },
        );

        if (verifyRes.status === 402 || !verifyRes.ok) {
            return new Response(
                JSON.stringify({
                    error: 'Payment not found',
                    message: `No payment found for address ${callerAddress}. Pay $0.01 USDC via Coal's paywall first.`,
                    verifyUrl: `${COAL_API_URL}/api/paywalls/${PAYWALL_ID}/verify`,
                    payTo: MERCHANT_PAYOUT,
                }),
                {
                    status: 402,
                    headers: {
                        'content-type': 'application/json',
                        'x-payment-required': 'true',
                        'x-payment-amount': '0.01',
                        'x-payment-currency': 'USDC',
                        'x-payment-network': 'base',
                        'x-payment-address': MERCHANT_PAYOUT,
                    },
                },
            );
        }
    } catch (err) {
        // If Coal API is down, fail open for demo purposes
        // In production, you'd fail closed (return 503)
        console.warn('Coal paywall verify failed, allowing access:', err);
    }

    // ── Fetch price data ─────────────────────────────────────────────────
    try {
        const priceData = await getPrice(symbol);

        return Response.json({
            ...priceData,
            paidBy: callerAddress,
            paywall: PAYWALL_ID,
            cost: '0.01 USDC',
            receipt: `Verify payment at ${COAL_API_URL}/api/paywalls/${PAYWALL_ID}/verify?address=${callerAddress}`,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch price data';
        return Response.json({ error: message }, { status: 404 });
    }
}
