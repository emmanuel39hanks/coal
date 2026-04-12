export default function Home() {
  const tools = [
    { name: 'discover_merchants', desc: 'Browse all merchants with products + paywalls' },
    { name: 'search_products', desc: 'Search by name, price, or tag' },
    { name: 'get_merchant_profile', desc: 'Full profile with 0G proof' },
    { name: 'query_merchant_memory', desc: 'AI Q&A against merchant data (0G Compute)' },
    { name: 'check_paywall', desc: 'x402 paywall status + pricing' },
    { name: 'create_checkout', desc: 'Create a USDC checkout on Base' },
    { name: 'get_checkout_status', desc: 'Check payment status' },
    { name: 'verify_receipt', desc: '3-step proof trail on 0G' },
    { name: 'get_0g_health', desc: '5 × 0G component status' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f2ed] font-sans">
      <div className="max-w-[640px] p-12 text-center">
        <span className="inline-block bg-black text-white px-4 py-1.5 rounded-full text-[11px] font-extrabold tracking-widest mb-6">
          MCP SERVER
        </span>
        <h1 className="text-4xl font-black text-[#180D43] mb-4 tracking-tight leading-tight">
          Coal Commerce
        </h1>
        <p className="text-base text-gray-500 leading-relaxed mb-8">
          Connect any MCP-compatible AI — Claude, ChatGPT, Gemini, Cursor — to the Coal merchant network.
          Discover products, create checkouts, pay in USDC on Base, verify receipts on 0G.
        </p>

        <div className="bg-white border border-black/5 rounded-2xl p-6 text-left mb-6">
          <div className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest mb-3">
            Connect from Claude Code
          </div>
          <code className="block bg-gray-50 px-4 py-3 rounded-xl text-sm font-mono text-[#180D43] overflow-x-auto">
            claude mcp add coal https://mcp.usecoal.xyz/api/mcp
          </code>
        </div>

        <div className="bg-white border border-black/5 rounded-2xl p-6 text-left mb-8">
          <div className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest mb-3">
            Available tools ({tools.length})
          </div>
          <div className="grid gap-2">
            {tools.map((t) => (
              <div key={t.name} className="flex gap-2 items-baseline">
                <code className="text-xs font-mono text-[#FF5C16] font-bold shrink-0">{t.name}</code>
                <span className="text-xs text-gray-400">— {t.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 justify-center flex-wrap">
          <a href="https://usecoal.xyz" className="text-sm font-bold text-[#FF5C16] px-5 py-2.5 rounded-full border-[1.5px] border-[#FF5C16] hover:bg-[#FF5C16] hover:text-white transition-colors">
            Coal Platform →
          </a>
          <a href="https://usecoal.xyz/docs/sdk/react" className="text-sm font-bold text-gray-500 px-5 py-2.5 rounded-full border-[1.5px] border-black/10 hover:border-black/20 transition-colors">
            Docs →
          </a>
          <a href="https://github.com/emmanuel39hanks/coal" className="text-sm font-bold text-gray-500 px-5 py-2.5 rounded-full border-[1.5px] border-black/10 hover:border-black/20 transition-colors">
            GitHub →
          </a>
        </div>

        <p className="text-[11px] text-gray-400 mt-8">
          Powered by <span className="font-bold text-[#180D43]">Coal</span> × <span className="font-bold text-[#180D43]">0G</span>
        </p>
      </div>
    </div>
  );
}
