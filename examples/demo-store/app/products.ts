/**
 * Shared product catalog for the demo store.
 *
 * This is the merchant's "source of truth" — in a real store it would be a
 * Postgres table, a Sanity CMS, a Shopify export, or any other backend.
 * Both the product grid (app/page.tsx) and the agent-discovery publisher
 * (<CoalAgentPublisher> on the same page) read from here, so they cannot
 * drift out of sync.
 *
 * The `externalId` field is what Coal's catalog indexing uses as the
 * idempotency key — the same value can be republished safely forever.
 */

export interface DemoStoreProduct {
    /** Merchant-owned stable id. Used as externalId by CoalAgentPublisher. */
    id: string;
    name: string;
    price: number;
    image: string;
    description: string;
    badge?: string;
    tags?: string[];
}

export const demoStoreProducts: DemoStoreProduct[] = [
    {
        id: 'prod_coffee',
        name: 'Super Coffee',
        price: 0.02,
        image:
            'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=800&q=80',
        description: 'Premium single-origin coffee beans',
        badge: 'Best Seller',
        tags: ['drink', 'coffee'],
    },
    {
        id: 'prod_hoodie',
        name: 'Dev Hoodie',
        price: 0.05,
        image:
            'https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=800&q=80',
        description: 'Cozy hoodie for late night coding',
        badge: 'New',
        tags: ['apparel', 'hoodie'],
    },
    {
        id: 'prod_cap',
        name: 'MNEE Cap',
        price: 0.03,
        image:
            'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=800&q=80',
        description: 'Classic cap with MNEE branding',
        tags: ['apparel', 'accessories'],
    },
    {
        id: 'prod_mug',
        name: 'Crypto Mug',
        price: 0.02,
        image:
            'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=800&q=80',
        description: 'Start your morning with blockchain vibes',
        tags: ['home', 'mug'],
    },
    {
        id: 'prod_tshirt',
        name: 'Web3 Tee',
        price: 0.04,
        image:
            'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80',
        description: 'Minimalist tee for the decentralized',
        badge: 'Popular',
        tags: ['apparel', 'tshirt'],
    },
    {
        id: 'prod_stickers',
        name: 'Sticker Pack',
        price: 0.01,
        image:
            'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80',
        description: '5 premium vinyl stickers',
        tags: ['accessories', 'stickers'],
    },
];

/**
 * Map the demo catalog to the `CoalAgentPublisher` product shape (externalId
 * + name + price + metadata). Kept as a pure function so the component
 * only re-runs when the product list actually changes.
 */
export function toCoalCatalog(
    products: DemoStoreProduct[],
): Array<{
    externalId: string;
    name: string;
    description: string;
    price: number;
    image: string;
    tags?: string[];
}> {
    return products.map((p) => ({
        externalId: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        image: p.image,
        tags: p.tags,
    }));
}
