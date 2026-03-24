import { MetadataRoute } from 'next';

const BASE_URL = 'https://usecoal.xyz';

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();

    const staticRoutes: MetadataRoute.Sitemap = [
        {
            url: BASE_URL,
            lastModified: now,
            changeFrequency: 'weekly',
            priority: 1.0,
        },
        {
            url: `${BASE_URL}/privacy`,
            lastModified: now,
            changeFrequency: 'yearly',
            priority: 0.4,
        },
        {
            url: `${BASE_URL}/terms`,
            lastModified: now,
            changeFrequency: 'yearly',
            priority: 0.4,
        },
    ];

    const docRoutes = [
        '/docs',
        '/docs/quickstart',
        '/docs/authentication',
        '/docs/environments',
        '/docs/payment-flow',
        '/docs/checkout-sessions',
        '/docs/payment-links',
        '/docs/products',
        '/docs/products/manage',
        '/docs/splits',
        '/docs/paywalls',
        '/docs/webhooks',
        '/docs/webhooks/signatures',
        '/docs/webhooks/retries',
        '/docs/multi-token',
        '/docs/mnee',
        '/docs/mnee/transactions',
        '/docs/auth-capture',
        '/docs/security',
        '/docs/security/rate-limits',
        '/docs/security/sanctions',
        '/docs/widget-embed',
        '/docs/sdk/javascript',
        '/docs/sdk/react',
        '/docs/sdk/events',
        '/docs/api/checkouts',
        '/docs/api/payment-links',
        '/docs/api/products',
        '/docs/api/paywalls',
        '/docs/api/splits',
        '/docs/api/webhooks',
    ].map((route) => ({
        url: `${BASE_URL}${route}`,
        lastModified: now,
        changeFrequency: 'monthly' as const,
        priority: route === '/docs' ? 0.9 : 0.7,
    }));

    return [...staticRoutes, ...docRoutes];
}
