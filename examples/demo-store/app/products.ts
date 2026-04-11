/**
 * Demo store catalog.
 *
 * These are the merchant's "source of truth" products. In a real store they
 * live in a Postgres table, a Sanity CMS, a Shopify export, etc. For this
 * demo they live here as a static TypeScript array so it's easy to see what
 * gets pushed into Coal via <CoalAgentPublisher>.
 *
 * The `id` field is what Coal's catalog indexing uses as `externalId` — the
 * idempotency key per merchant. We prefix with `ds_` so the published
 * products cannot collide with Saint's console-created products, and the
 * publisher runs in `upsert` mode so Saint's existing catalog is untouched.
 */

export interface DemoStoreProduct {
    /** Merchant-owned stable id. Becomes externalId when indexed on Coal. */
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
        id: 'ds_agent_handbook',
        name: 'Agentic Commerce Handbook',
        price: 0.10,
        image:
            'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=800&q=80',
        description:
            'The definitive field guide to building stores that AI agents can discover and buy from. 180 pages. PDF download.',
        badge: 'Best Seller',
        tags: ['book', 'digital', 'agentic-commerce'],
    },
    {
        id: 'ds_0g_starter_kit',
        name: '0G Integration Starter Kit',
        price: 0.15,
        image:
            'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=800&q=80',
        description:
            'Drop-in scaffolds for all 5 0G components (Storage, Chain, Compute, KV, DA) with tests.',
        badge: 'New',
        tags: ['template', 'digital', '0g'],
    },
    {
        id: 'ds_x402_cheatsheet',
        name: 'x402 Protocol Cheatsheet',
        price: 0.05,
        image:
            'https://images.unsplash.com/photo-1516116216624-53e697fedbea?auto=format&fit=crop&w=800&q=80',
        description:
            'One-page reference: HTTP 402 headers, verify flow, payment settlement, error codes.',
        tags: ['reference', 'digital', 'x402'],
    },
    {
        id: 'ds_merchant_playbook',
        name: 'Merchant Onboarding Playbook',
        price: 0.20,
        image:
            'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=800&q=80',
        description:
            'Everything a crypto-native store needs to launch an agent-discoverable checkout in 24 hours.',
        tags: ['book', 'digital', 'onboarding'],
    },
    {
        id: 'ds_prompt_library',
        name: 'Agent Commerce Prompt Library',
        price: 0.08,
        image:
            'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=800&q=80',
        description:
            '200+ battle-tested prompts for building AI agents that can discover products, negotiate, and pay.',
        badge: 'Popular',
        tags: ['prompts', 'digital', 'ai'],
    },
    {
        id: 'ds_sdk_quickstart',
        name: 'Coal SDK Quickstart Bundle',
        price: 0.03,
        image:
            'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=800&q=80',
        description:
            'Pre-wired Next.js starter + coal-react examples. Go from npm install to agent-buyable in 10 minutes.',
        tags: ['template', 'digital', 'sdk'],
    },
];

/**
 * Map the demo catalog to the `CoalAgentPublisher` product shape. Kept as a
 * pure function so the component only re-runs when the product list actually
 * changes.
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
