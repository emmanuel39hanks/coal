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
        image: 'https://picsum.photos/seed/agent-handbook/800/1000',
        description:
            'The definitive field guide to building stores that AI agents can discover and buy from. 180 pages. PDF download.',
        badge: 'Best Seller',
        tags: ['book', 'digital', 'agentic-commerce'],
    },
    {
        id: 'ds_0g_starter_kit',
        name: '0G Integration Starter Kit',
        price: 0.15,
        image: 'https://picsum.photos/seed/zerog-kit/800/1000',
        description:
            'Drop-in scaffolds for all 5 0G components (Storage, Chain, Compute, KV, DA) with tests.',
        badge: 'New',
        tags: ['template', 'digital', '0g'],
    },
    {
        id: 'ds_x402_cheatsheet',
        name: 'x402 Protocol Cheatsheet',
        price: 0.05,
        image: 'https://picsum.photos/seed/x402/800/1000',
        description:
            'One-page reference: HTTP 402 headers, verify flow, payment settlement, error codes.',
        tags: ['reference', 'digital', 'x402'],
    },
    {
        id: 'ds_merchant_playbook',
        name: 'Merchant Onboarding Playbook',
        price: 0.20,
        image: 'https://picsum.photos/seed/merchant-playbook/800/1000',
        description:
            'Everything a crypto-native store needs to launch an agent-discoverable checkout in 24 hours.',
        tags: ['book', 'digital', 'onboarding'],
    },
    {
        id: 'ds_prompt_library',
        name: 'Agent Commerce Prompt Library',
        price: 0.08,
        image: 'https://picsum.photos/seed/prompt-library/800/1000',
        description:
            '200+ battle-tested prompts for building AI agents that can discover products, negotiate, and pay.',
        badge: 'Popular',
        tags: ['prompts', 'digital', 'ai'],
    },
    {
        id: 'ds_sdk_quickstart',
        name: 'Coal SDK Quickstart Bundle',
        price: 0.03,
        image: 'https://picsum.photos/seed/sdk-quickstart/800/1000',
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
