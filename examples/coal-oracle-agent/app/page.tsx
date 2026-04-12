export default function Home() {
  const examples = [
    { symbol: 'ETH', type: 'Crypto', source: 'CoinGecko' },
    { symbol: 'BTC', type: 'Crypto', source: 'CoinGecko' },
    { symbol: 'SOL', type: 'Crypto', source: 'CoinGecko' },
    { symbol: '0G', type: 'Crypto', source: 'CoinGecko' },
    { symbol: 'AAPL', type: 'Stock', source: 'Yahoo Finance' },
    { symbol: 'TSLA', type: 'Stock', source: 'Yahoo Finance' },
    { symbol: 'NVDA', type: 'Stock', source: 'Yahoo Finance' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f2ed] font-sans">
      <div className="max-w-[640px] p-12 text-center">
        <span className="inline-block bg-[#FF5C16] text-white px-4 py-1.5 rounded-full text-[11px] font-extrabold tracking-widest mb-6">
          AGENT-TO-AGENT COMMERCE
        </span>
        <h1 className="text-4xl font-black text-[#180D43] mb-4 tracking-tight leading-tight">
          Price Oracle
        </h1>
        <p className="text-base text-gray-500 leading-relaxed mb-8">
          Real-time price data for any crypto token or stock ticker.
          $0.01 per call via Coal&apos;s x402 paywall. Pay in USDC on Base.
          No API key needed — just pay and query.
        </p>

        <div className="bg-white border border-black/5 rounded-2xl p-6 text-left mb-6">
          <div className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest mb-3">
            Endpoint
          </div>
          <code className="block bg-gray-50 px-4 py-3 rounded-xl text-sm font-mono text-[#180D43] overflow-x-auto">
            GET /api/price/:symbol?address=YOUR_WALLET
          </code>
          <div className="mt-3 text-xs text-gray-400">
            Returns 402 without payment. Returns price data after payment.
          </div>
        </div>

        <div className="bg-white border border-black/5 rounded-2xl p-6 text-left mb-6">
          <div className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest mb-3">
            Supported tickers
          </div>
          <div className="grid grid-cols-2 gap-2">
            {examples.map((e) => (
              <div key={e.symbol} className="flex items-center gap-2 text-sm">
                <code className="text-[#FF5C16] font-bold font-mono">{e.symbol}</code>
                <span className="text-gray-400">
                  {e.type} · {e.source}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-gray-400">
            Any CoinGecko crypto ticker or Yahoo Finance stock symbol works.
          </div>
        </div>

        <div className="bg-white border border-black/5 rounded-2xl p-6 text-left mb-8">
          <div className="text-[11px] font-extrabold text-gray-400 uppercase tracking-widest mb-3">
            How agents use this
          </div>
          <ol className="text-sm text-gray-600 space-y-2 list-decimal pl-5">
            <li>Agent discovers this oracle via Coal&apos;s MCP server or discovery API</li>
            <li>Agent hits <code className="bg-gray-50 px-1.5 py-0.5 rounded text-xs font-mono">/api/price/ETH</code> → gets 402 with payment info</li>
            <li>Agent creates a Coal checkout for $0.01 USDC</li>
            <li>Agent pays via ERC-3009 (gasless, operator-relayed)</li>
            <li>Agent retries with <code className="bg-gray-50 px-1.5 py-0.5 rounded text-xs font-mono">?address=0x...</code> → gets live price data</li>
          </ol>
        </div>

        <div className="flex gap-3 justify-center flex-wrap">
          <a href="https://mcp.usecoal.xyz" className="text-sm font-bold text-[#FF5C16] px-5 py-2.5 rounded-full border-[1.5px] border-[#FF5C16] hover:bg-[#FF5C16] hover:text-white transition-colors">
            MCP Server →
          </a>
          <a href="https://store.usecoal.xyz" className="text-sm font-bold text-gray-500 px-5 py-2.5 rounded-full border-[1.5px] border-black/10 hover:border-black/20 transition-colors">
            Demo Store →
          </a>
          <a href="https://agent.usecoal.xyz" className="text-sm font-bold text-gray-500 px-5 py-2.5 rounded-full border-[1.5px] border-black/10 hover:border-black/20 transition-colors">
            Agent Sandbox →
          </a>
        </div>

        <p className="text-[11px] text-gray-400 mt-8">
          Powered by <span className="font-bold text-[#180D43]">Coal</span> × <span className="font-bold text-[#180D43]">0G</span> · Agent-to-agent commerce on Base
        </p>
      </div>
    </div>
  );
}
