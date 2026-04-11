import Image from "next/image";
import { CoalAgentPublisher, CoalProvider, CoalSchemaOrg } from "coal-react";
import { createCheckout } from "./actions";
import { demoStoreProducts, toCoalCatalog } from "./products";

const MERCHANT_ID =
  process.env.NEXT_PUBLIC_COAL_MERCHANT_ID || "lst00PqEWRwcM4roiOcSpD8WfxlBc2hH";

export default function Home() {
  return (
    <CoalProvider merchantId={MERCHANT_ID}>
      {/*
       * Inject Schema.org Product / Offer markup so ChatGPT, Perplexity, and
       * Google AI Overviews can cite this store when answering shopping
       * questions. Rendered via safeJsonForScriptTag — no XSS risk from
       * product fields.
       */}
      <CoalSchemaOrg />

      {/*
       * Catalog indexing. Every time this page renders, the merchant's
       * product catalog gets indexed on 0G Storage (Log layer) + KV (mutable
       * mirror) via the proxy route. Agents hitting api.usecoal.xyz/api/
       * agent/discover can then find these products. Debounced 30s.
       *
       * The shared-secret header is demo-grade auth — see the comment block
       * in app/api/coal/publish-catalog/route.ts for the production pattern.
       */}
      <CoalAgentPublisher
        products={toCoalCatalog(demoStoreProducts)}
        proxyUrl="/api/coal/publish-catalog"
        mode="upsert"
        headers={{
          "x-coal-publish-secret":
            process.env.NEXT_PUBLIC_COAL_PUBLISH_PROXY_SECRET || "",
        }}
      />

      <div className="min-h-screen bg-white font-sans text-gray-900 selection:bg-orange-100">
        <nav className="fixed top-0 inset-x-0 bg-white/80 backdrop-blur-md z-50 border-b border-gray-100 px-8 py-5 flex justify-between items-center transition-all">
          <div className="font-bold text-xl tracking-tighter">store.</div>
          <div className="flex gap-8 text-sm font-medium text-gray-500">
            <a href="#" className="hover:text-black transition-colors">Shop</a>
            <a href="#" className="hover:text-black transition-colors">Collections</a>
            <a href="#" className="hover:text-black transition-colors">About</a>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/.well-known/agent-card.json"
              className="text-xs font-medium text-gray-400 hover:text-black transition-colors"
              title="A2A Agent Card — machine-readable merchant profile"
            >
              agent-card.json
            </a>
            <button className="relative group">
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full"></span>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
            </button>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-6 py-32">
          <div className="text-center mb-24 max-w-2xl mx-auto">
            <span className="inline-block px-3 py-1 text-[10px] uppercase tracking-[0.2em] font-bold rounded-full bg-orange-50 text-orange-600 mb-6">
              Agent-Discoverable · Powered by Coal on 0G
            </span>
            <h1 className="text-5xl font-bold tracking-tight mb-6">Ethical Goods for <br /> <span className="text-gray-400">Digital Citizens.</span></h1>
            <p className="text-lg text-gray-500">Premium quality, sustainably sourced. Humans check out here. AI agents discover and buy from <span className="font-mono text-xs">api.usecoal.xyz/api/agent/discover</span>.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {demoStoreProducts.map((product) => (
              <div key={product.id} className="group cursor-pointer">
                <div className="relative aspect-[4/5] bg-gray-100 mb-6 overflow-hidden rounded-md">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {product.badge && (
                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-sm">
                      {product.badge}
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold mb-1">{product.name}</h3>
                    <p className="text-gray-500 text-sm">{product.price.toFixed(2)} USDC</p>
                  </div>
                </div>

                <form action={createCheckout}>
                  <input type="hidden" name="productId" value={product.id} />
                  <input type="hidden" name="productName" value={product.name} />
                  <input type="hidden" name="productDescription" value={product.description} />
                  <input type="hidden" name="productImage" value={product.image} />
                  <input type="hidden" name="amount" value={product.price} />
                  <button
                    type="submit"
                    className="w-full bg-black text-white h-12 rounded-full font-medium text-sm hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 group-hover:shadow-lg"
                  >
                    Buy with Coal
                  </button>
                </form>
              </div>
            ))}
          </div>

          <div className="mt-32 pt-16 border-t border-gray-100 max-w-3xl mx-auto text-center">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4">How an AI agent discovers this store</h2>
            <p className="text-gray-500 leading-relaxed">
              The <code className="bg-gray-100 px-2 py-0.5 rounded text-sm font-mono">{`<CoalAgentPublisher />`}</code> component at the top of this page
              auto-publishes the catalog above to 0G Storage and mirrors it to 0G KV every time a visitor lands.
              Agents crawling the web read <a className="text-orange-600 font-medium hover:underline" href="/.well-known/agent-card.json">/.well-known/agent-card.json</a>,
              <a className="text-orange-600 font-medium hover:underline" href="/llms.txt"> /llms.txt</a>, or
              <a className="text-orange-600 font-medium hover:underline" href="/.well-known/x402.json"> /.well-known/x402.json</a> to find everything for sale here.
              Every agent purchase uses the same Coal rails as human checkout above, with a verifiable 3-step proof trail on 0G.
            </p>
          </div>
        </main>

        <footer className="py-12 text-center text-sm text-gray-400 border-t border-gray-100">
          <p>© 2026 Demo Store. Powered by Coal Payments on 0G.</p>
        </footer>
      </div>
    </CoalProvider>
  );
}
