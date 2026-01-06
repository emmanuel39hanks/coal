import Image from "next/image";
import { createCheckout } from "./actions";

const products = [
  {
    id: "prod_coffee",
    name: "Super Coffee",
    price: 0.02,
    image: "https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=800&q=80",
    description: "Premium single-origin coffee beans",
    badge: "Best Seller"
  },
  {
    id: "prod_hoodie",
    name: "Dev Hoodie",
    price: 0.05,
    image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=800&q=80",
    description: "Cozy hoodie for late night coding",
    badge: "New"
  },
  {
    id: "prod_cap",
    name: "MNEE Cap",
    price: 0.03,
    image: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=800&q=80",
    description: "Classic cap with MNEE branding"
  },
  {
    id: "prod_mug",
    name: "Crypto Mug",
    price: 0.02,
    image: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=800&q=80",
    description: "Start your morning with blockchain vibes"
  },
  {
    id: "prod_tshirt",
    name: "Web3 Tee",
    price: 0.04,
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80",
    description: "Minimalist tee for the decentralized",
    badge: "Popular"
  },
  {
    id: "prod_stickers",
    name: "Sticker Pack",
    price: 0.01,
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80",
    description: "5 premium vinyl stickers"
  }
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 selection:bg-orange-100">
      <nav className="fixed top-0 inset-x-0 bg-white/80 backdrop-blur-md z-50 border-b border-gray-100 px-8 py-5 flex justify-between items-center transition-all">
        <div className="font-bold text-xl tracking-tighter">store.</div>
        <div className="flex gap-8 text-sm font-medium text-gray-500">
          <a href="#" className="hover:text-black transition-colors">Shop</a>
          <a href="#" className="hover:text-black transition-colors">Collections</a>
          <a href="#" className="hover:text-black transition-colors">About</a>
        </div>
        <button className="relative group">
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full"></span>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
        </button>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-32">
        <div className="text-center mb-24 max-w-2xl mx-auto">
          <h1 className="text-5xl font-bold tracking-tight mb-6">Ethical Goods for <br /> <span className="text-gray-400">Digital Citizens.</span></h1>
          <p className="text-lg text-gray-500">Premium quality, sustainably sourced, and powered by MNEE payments.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-12">
          {products.map((product) => (
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
                  <p className="text-gray-500 text-sm">{product.price.toFixed(2)} MNEE</p>
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
      </main>

      <footer className="py-12 text-center text-sm text-gray-400 border-t border-gray-100">
        <p>© 2026 Demo Store. Powered by Coal Payments.</p>
      </footer>
    </div>
  );
}