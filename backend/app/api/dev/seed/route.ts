import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { logger } from '@/lib/logger';

// DEV ONLY: seed route is blocked in production.
// Idempotent — safe to call many times; creates the merchant + demo
// products + payment links only if missing. Returns slugs for the
// Mini App to consume via NEXT_PUBLIC_DEMO_LINK_SLUGS.
export async function GET(request: Request) {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Dev only' }, { status: 403 });
    }

    // Require DEV_SEED_SECRET unconditionally — block access if not configured
    const seedSecret = process.env.DEV_SEED_SECRET;
    if (!seedSecret) {
        return NextResponse.json({ error: 'DEV_SEED_SECRET not configured' }, { status: 403 });
    }
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${seedSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 1. Create (or reuse) a dev merchant with a payout address so
        //    the cron has something to verify Transfer events against.
        const userEmail = 'dev@usecoal.xyz';
        // Default payout wallet: the operator account itself. Not
        // realistic in prod, but keeps the demo self-contained.
        const payoutAddress =
            process.env.DEV_SEED_PAYOUT_ADDRESS ||
            '0x83d412b9dc65fc728455a1AFE00cE8812CdCce13';

        let user = await prisma.user.findUnique({ where: { email: userEmail } });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    email: userEmail,
                    name: 'Dev Merchant',
                    payoutAddress,
                    onboardingComplete: true,
                },
            });
        } else if (!user.payoutAddress) {
            user = await prisma.user.update({
                where: { id: user.id },
                data: { payoutAddress, onboardingComplete: true },
            });
        }

        // 2. API Key — always mint a fresh one (callers want a raw key
        //    and we only show it once).
        const keyRaw = `coal_live_${crypto.randomBytes(24).toString('hex')}`;
        const hashed = crypto.createHash('sha256').update(keyRaw).digest('hex');

        await prisma.apiKey.create({
            data: {
                merchantId: user.id,
                keyPrefix: 'coal_live_',
                secretHash: hashed,
                name: 'Dev Key',
            },
        });

        // 3. Demo products + payment links — idempotent by SKU / slug.
        //    Prices are intentionally tiny so e2e tests cost < $0.10.
        interface DemoSpec {
            sku: string;
            slug: string;
            name: string;
            description: string;
            price: string;
            image: string;
        }

        const DEMO_PRODUCTS: DemoSpec[] = [
            {
                sku: 'coal-tshirt',
                slug: 'coal-tshirt',
                name: 'Coal T-Shirt',
                description: 'Premium cotton tee with the Coal logo. Unisex fit.',
                price: '0.01',
                image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=600&q=60',
            },
            {
                sku: 'coal-sticker-pack',
                slug: 'coal-sticker-pack',
                name: 'Sticker Pack · 6pcs',
                description: 'Six holographic Coal stickers for your laptop.',
                price: '0.01',
                image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=600&q=60',
            },
            {
                sku: 'coal-cap',
                slug: 'coal-cap',
                name: 'Coal Snapback Cap',
                description: 'Structured snapback with embroidered Coal wordmark.',
                price: '0.02',
                image: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=600&q=60',
            },
            {
                sku: 'coal-hoodie',
                slug: 'coal-hoodie',
                name: 'Coal Hoodie',
                description: 'Heavyweight 400gsm hoodie. Built for builders.',
                price: '0.03',
                image: 'https://images.unsplash.com/photo-1556821840-3a63f15732ce?auto=format&fit=crop&w=600&q=60',
            },
            {
                sku: 'coal-api-credits',
                slug: 'coal-api-credits',
                name: 'API Credits · 500 calls',
                description: 'Pre-paid bundle for the Coal agent commerce API.',
                price: '0.05',
                image: 'https://images.unsplash.com/photo-1639322537228-f710d846310a?auto=format&fit=crop&w=600&q=60',
            },
        ];

        const seededLinks: { slug: string; productName: string; price: string }[] = [];
        for (const spec of DEMO_PRODUCTS) {
            let product = await prisma.product.findFirst({
                where: { merchantId: user.id, sku: spec.sku },
            });
            if (!product) {
                product = await prisma.product.create({
                    data: {
                        merchantId: user.id,
                        name: spec.name,
                        description: spec.description,
                        price: spec.price,
                        sku: spec.sku,
                        image: spec.image,
                        active: true,
                        source: 'console',
                    },
                });
            }

            let link = await prisma.paymentLink.findUnique({ where: { slug: spec.slug } });
            if (!link) {
                link = await prisma.paymentLink.create({
                    data: {
                        merchantId: user.id,
                        productId: product.id,
                        slug: spec.slug,
                        active: true,
                        title: spec.name,
                        description: spec.description,
                    },
                });
            }

            seededLinks.push({
                slug: link.slug,
                productName: product.name,
                price: product.price.toString(),
            });
        }

        return NextResponse.json({
            message: 'Seed Successful',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                payoutAddress: user.payoutAddress,
            },
            apiKey: keyRaw,
            links: seededLinks,
            // Ready-to-paste value for examples/coal-mini-app/.env.local
            miniAppLinkSlugs: seededLinks.map((l) => l.slug).join(','),
        });
    } catch (error) {
        logger.error({ err: error }, 'Seed error');
        return NextResponse.json({ error: 'Seed operation failed' }, { status: 500 });
    }
}
