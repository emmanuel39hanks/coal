#!/usr/bin/env node
/**
 * Generates the "0G Builder's Cheatsheet" PDF.
 *
 * Run from this dir:
 *   node scripts/generate-0g-cheatsheet.mjs
 *
 * Output:
 *   public/downloads/0g-builders-cheatsheet.pdf
 *
 * Stack: Puppeteer (Chromium-headless) — same approach Coal uses for the
 * demo deck. Reuses the codebase's existing puppeteer dependency.
 */

import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'downloads');
const OUT_PATH = path.join(OUT_DIR, '0g-builders-cheatsheet.pdf');

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>The 0G Builder's Cheatsheet</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; color: #0c0c1f; line-height: 1.55; }
  body { font-size: 11.5pt; }
  h1 { font-weight: 900; letter-spacing: -0.02em; }
  h2 { font-weight: 800; letter-spacing: -0.01em; }
  h3 { font-weight: 700; }
  code, pre, .mono { font-family: 'JetBrains Mono', monospace; }
  a { color: #ff5c16; text-decoration: none; }
  .accent { color: #ff5c16; }
  .navy { color: #180d43; }
  .muted { color: #5a5a7a; }

  /* Cover page */
  .cover {
    height: 100vh;
    background: linear-gradient(135deg, #180d43 0%, #2a1a6f 60%, #ff5c16 100%);
    color: white;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 60px 56px;
    page-break-after: always;
  }
  .cover .brand { font-size: 14pt; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.9; }
  .cover h1 { font-size: 56pt; line-height: 1; margin: 16px 0 0; }
  .cover .subtitle { font-size: 18pt; font-weight: 500; margin-top: 16px; opacity: 0.85; }
  .cover .footer { font-size: 10pt; font-family: 'JetBrains Mono', monospace; opacity: 0.7; }
  .cover .badge { display: inline-block; background: rgba(255,255,255,0.15); padding: 6px 14px; border-radius: 999px; font-size: 9pt; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 24px; }

  /* Content pages */
  .page {
    padding: 56px;
    page-break-after: always;
  }
  .page:last-child { page-break-after: auto; }
  .page header { display: flex; justify-content: space-between; font-size: 8pt; font-family: 'JetBrains Mono', monospace; color: #ff5c16; text-transform: uppercase; letter-spacing: 0.1em; padding-bottom: 14px; border-bottom: 2px solid #ff5c16; margin-bottom: 28px; }
  h2 { font-size: 22pt; margin: 0 0 6px; color: #180d43; }
  h2 + .lede { font-size: 12pt; color: #5a5a7a; margin: 0 0 24px; font-weight: 500; }
  h3 { font-size: 13pt; margin: 24px 0 8px; color: #180d43; }

  ul, ol { padding-left: 18px; margin: 0 0 14px; }
  li { margin-bottom: 4px; }

  table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 10pt; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e9e9f0; }
  th { background: #f6f6fa; font-weight: 700; color: #180d43; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.06em; }
  td.mono { font-family: 'JetBrains Mono', monospace; font-size: 9pt; word-break: break-all; }

  pre {
    background: #180d43;
    color: #e9e9f0;
    padding: 16px 18px;
    border-radius: 8px;
    font-size: 9pt;
    line-height: 1.5;
    overflow: hidden;
    margin: 12px 0 16px;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  pre .keyword { color: #ff5c16; }
  pre .string { color: #a3e635; }
  pre .comment { color: #7a7a99; font-style: italic; }

  .callout {
    background: #fff5ef;
    padding: 16px 20px;
    border-radius: 12px;
    margin: 16px 0;
    font-size: 10.5pt;
    color: #4a3520;
  }
  .callout strong { color: #ff5c16; font-weight: 800; }

  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .card { background: #f6f6fa; padding: 16px 18px; border-radius: 10px; }
  .card h4 { margin: 0 0 6px; font-size: 11pt; font-weight: 800; color: #180d43; }
  .card p { margin: 0; font-size: 9.5pt; color: #5a5a7a; }

  .footer-bar { font-size: 8pt; color: #999; text-align: center; padding-top: 24px; margin-top: 28px; border-top: 1px solid #e9e9f0; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.04em; }
</style>
</head>
<body>

<!-- COVER -->
<section class="cover">
  <div>
    <div class="brand">0G · Cheatsheet for Builders</div>
    <h1>The 0G<br/>Builder's<br/>Cheatsheet</h1>
    <div class="subtitle">Storage. Chain. Compute. DA.<br/>Everything an AI agent needs in one stack.</div>
    <div class="badge">Coal Edition · v1.0 · 2026</div>
  </div>
  <div class="footer">
    Distributed via Coal · usecoal.xyz · Pay-per-use commerce for AI agents on 0G + Base.
  </div>
</section>

<!-- PAGE 1: WHAT IS 0G -->
<section class="page">
  <header>
    <span>0G Cheatsheet</span>
    <span>01 / What is 0G</span>
  </header>
  <h2>What is 0G?</h2>
  <p class="lede">A modular AI Layer-1 designed for the agent economy: programmable storage, on-chain proofs, decentralized inference, and data availability — all in one stack.</p>

  <p>Unlike general-purpose L1s, 0G ships purpose-built primitives the AI workload needs out of the box. You don't compose 5 different protocols — they're already there as a coherent OS.</p>

  <div class="grid-2">
    <div class="card">
      <h4>0G Storage</h4>
      <p>Content-addressable, replicated, queryable. Drop a JSON or PDF, get a SHA-256 root hash. Verifiable from anywhere.</p>
    </div>
    <div class="card">
      <h4>0G Chain</h4>
      <p>EVM-compatible Layer-1. Anchor receipt hashes, deploy contracts, run Coal-style payment infra natively.</p>
    </div>
    <div class="card">
      <h4>0G Compute</h4>
      <p>Decentralized inference marketplace. OpenAI-compatible API + TEE-backed sealed inference for sensitive prompts.</p>
    </div>
    <div class="card">
      <h4>0G DA</h4>
      <p>Data availability for rollups + agent event logs. Cheap, persistent, queryable bytes.</p>
    </div>
  </div>

  <div class="callout">
    <strong>Builder note:</strong> 0G is the only L1 where Coal can run all 5 of its proof layers (Storage receipts, Chain anchoring, Compute-backed memory, KV state, DA logs) on one chain. That's why we ship here.
  </div>
</section>

<!-- PAGE 2: NETWORK QUICK REFERENCE -->
<section class="page">
  <header>
    <span>0G Cheatsheet</span>
    <span>02 / Network Reference</span>
  </header>
  <h2>Network Quick Reference</h2>
  <p class="lede">Mainnet + Galileo testnet. The 30-second config you'll always come back to.</p>

  <h3>Mainnet</h3>
  <table>
    <tr><th>Field</th><th>Value</th></tr>
    <tr><td>Chain ID</td><td class="mono">16601</td></tr>
    <tr><td>RPC URL</td><td class="mono">https://evmrpc.0g.ai</td></tr>
    <tr><td>Explorer</td><td class="mono">https://chainscan.0g.ai</td></tr>
    <tr><td>Native token</td><td class="mono">0G</td></tr>
    <tr><td>Storage gateway</td><td class="mono">https://storage.0g.ai</td></tr>
    <tr><td>Compute broker</td><td class="mono">SDK: @0glabs/0g-serving-broker</td></tr>
    <tr><td>Receipt anchor (Coal)</td><td class="mono">0x24a80A3Bb16d26D4063Ecd4B2fD64C6856E25E8b</td></tr>
  </table>

  <h3>Galileo Testnet</h3>
  <table>
    <tr><th>Field</th><th>Value</th></tr>
    <tr><td>Chain ID</td><td class="mono">16601 (Galileo)</td></tr>
    <tr><td>RPC URL</td><td class="mono">https://evmrpc-testnet.0g.ai</td></tr>
    <tr><td>Explorer</td><td class="mono">https://chainscan-galileo.0g.ai</td></tr>
    <tr><td>Faucet</td><td class="mono">https://faucet.0g.ai</td></tr>
  </table>

  <h3>Wallet config snippet (viem)</h3>
  <pre><span class="keyword">import</span> { defineChain } <span class="keyword">from</span> <span class="string">'viem'</span>;

<span class="keyword">export const</span> zeroG = <span class="keyword">defineChain</span>({
  id: 16601,
  name: <span class="string">'0G Mainnet'</span>,
  nativeCurrency: { name: <span class="string">'0G'</span>, symbol: <span class="string">'0G'</span>, decimals: 18 },
  rpcUrls: { default: { http: [<span class="string">'https://evmrpc.0g.ai'</span>] } },
  blockExplorers: { default: { name: <span class="string">'0G Scan'</span>, url: <span class="string">'https://chainscan.0g.ai'</span> } },
});</pre>

  <div class="callout">
    <strong>Watch out:</strong> The most common 0G integration bug is mismatched chain IDs — Coal's <span class="mono">env.ts</span> defaults to 16601, but if your RPC URL points at testnet, every <span class="mono">eth_chainId</span> call returns 16600 and your tx attempts will silently fail. Verify with <span class="mono">curl -X POST $RPC -d '{"method":"eth_chainId","jsonrpc":"2.0","id":1}'</span> before any deploy.
  </div>
</section>

<!-- PAGE 3: 0G STORAGE -->
<section class="page">
  <header>
    <span>0G Cheatsheet</span>
    <span>03 / 0G Storage</span>
  </header>
  <h2>0G Storage</h2>
  <p class="lede">Decentralized object store. Content-addressable. Built for verifiable JSON, blobs, and documents.</p>

  <h3>Upload a JSON document</h3>
  <pre><span class="keyword">import</span> { ZeroGStorageClient } <span class="keyword">from</span> <span class="string">'@0gfoundation/0g-ts-sdk'</span>;
<span class="keyword">import</span> { Wallet } <span class="keyword">from</span> <span class="string">'ethers'</span>;

<span class="keyword">const</span> wallet = <span class="keyword">new</span> Wallet(process.env.OPERATOR_KEY!);
<span class="keyword">const</span> client = <span class="keyword">new</span> ZeroGStorageClient({
  rpcUrl: <span class="string">'https://evmrpc.0g.ai'</span>,
  storageGateway: <span class="string">'https://storage.0g.ai'</span>,
  signer: wallet,
});

<span class="keyword">const</span> { rootHash, txHash } = <span class="keyword">await</span> client.<span class="keyword">uploadJson</span>({
  type: <span class="string">'coal.receipt.v1'</span>,
  payload: { sessionId: <span class="string">'cs_123'</span>, amount: <span class="string">'0.10'</span>, currency: <span class="string">'USDC'</span> },
});
<span class="comment">// rootHash = '0xfb508c72dddcfb2a8448affebb37f6c083df1eb8b5b98e200a246f2838d3c1c1'</span></pre>

  <h3>Retrieve by root hash</h3>
  <pre><span class="keyword">const</span> raw = <span class="keyword">await</span> fetch(<span class="string">\`https://storage.0g.ai/file?root=\${rootHash}\`</span>).<span class="keyword">then</span>(r =&gt; r.text());
<span class="keyword">const</span> doc = JSON.<span class="keyword">parse</span>(raw);</pre>

  <h3>Anchor the hash on 0G Chain</h3>
  <p>Storage alone gives you a content-addressable URL. To make it tamper-proof, anchor the SHA-256 of the payload on 0G Chain via Coal's <span class="mono">CoalReceiptAnchor</span> contract:</p>
  <pre><span class="keyword">await</span> publicClient.<span class="keyword">writeContract</span>({
  address: <span class="string">'0x24a80A3Bb16d26D4063Ecd4B2fD64C6856E25E8b'</span>,
  abi: ANCHOR_ABI,
  functionName: <span class="string">'anchor'</span>,
  args: [rootHash, payloadSha256],
});</pre>

  <p>Three-step proof trail: <strong>(1)</strong> Storage URI → <strong>(2)</strong> Storage root hash → <strong>(3)</strong> Chain anchor. Coal calls this the <em>receipt trail</em>, and every paid checkout produces one automatically.</p>
</section>

<!-- PAGE 4: 0G COMPUTE -->
<section class="page">
  <header>
    <span>0G Cheatsheet</span>
    <span>04 / 0G Compute</span>
  </header>
  <h2>0G Compute</h2>
  <p class="lede">Decentralized inference marketplace. OpenAI-compatible. TEE-backed sealed inference for sensitive workloads.</p>

  <h3>Mint a session token (24h validity)</h3>
  <pre><span class="keyword">import</span> { createZGComputeNetworkBroker } <span class="keyword">from</span> <span class="string">'@0glabs/0g-serving-broker'</span>;
<span class="keyword">import</span> { Wallet, JsonRpcProvider } <span class="keyword">from</span> <span class="string">'ethers'</span>;

<span class="keyword">const</span> wallet = <span class="keyword">new</span> Wallet(process.env.OPERATOR_KEY!, <span class="keyword">new</span> JsonRpcProvider(<span class="string">'https://evmrpc.0g.ai'</span>));
<span class="keyword">const</span> broker = <span class="keyword">await</span> <span class="keyword">createZGComputeNetworkBroker</span>(wallet);
<span class="keyword">const</span> headers = <span class="keyword">await</span> broker.inference.<span class="keyword">getRequestHeaders</span>(providerAddress);
<span class="keyword">const</span> apiKey = headers.Authorization.<span class="keyword">replace</span>(<span class="string">/^Bearer /</span>, <span class="string">''</span>);</pre>

  <h3>Call the OpenAI-compatible endpoint</h3>
  <pre><span class="keyword">import</span> OpenAI <span class="keyword">from</span> <span class="string">'openai'</span>;

<span class="keyword">const</span> openai = <span class="keyword">new</span> OpenAI({
  apiKey,
  baseURL: <span class="string">'https://integratenetwork.work/v1/proxy'</span>,
});

<span class="keyword">const</span> chat = <span class="keyword">await</span> openai.chat.completions.<span class="keyword">create</span>({
  model: <span class="string">'qwen3.6-plus'</span>,
  messages: [{ role: <span class="string">'user'</span>, content: <span class="string">'What does 0G ship?'</span> }],
});</pre>

  <h3>Sealed Inference (TEE)</h3>
  <p>For prompts containing PII, financial data, or regulated content, route through a sealed-inference provider. The TEE attestation proves the model never saw raw plaintext outside the enclave. Coal uses this for the <span class="mono">evaluate_policy</span> tool — merchant policies are queried without exposing the underlying rules to the inference provider.</p>

  <div class="callout">
    <strong>Token TTL gotcha:</strong> 0G Compute session tokens expire every ~24h. Your server must mint fresh tokens via the broker SDK on cold-start AND retry on mid-stream "session token expired" errors. Coal's <span class="mono">lib/0g-token.ts</span> shows the cache-and-retry pattern.
  </div>
</section>

<!-- PAGE 5: HEALTH CHECK PATTERN -->
<section class="page">
  <header>
    <span>0G Cheatsheet</span>
    <span>05 / Health · Patterns</span>
  </header>
  <h2>Health-check pattern</h2>
  <p class="lede">Every production 0G app should expose a /health endpoint that pings all 5 components. Catches RPC outages, expired tokens, and broken indexers before users do.</p>

  <h3>Ship this endpoint on day 1</h3>
  <pre><span class="keyword">export async function</span> GET() {
  <span class="keyword">const</span> checks = <span class="keyword">await</span> Promise.<span class="keyword">allSettled</span>([
    <span class="comment">// Storage: round-trip a small object</span>
    fetch(<span class="string">\`\${STORAGE_GATEWAY}/file?root=\${HEALTH_HASH}\`</span>),
    <span class="comment">// Chain: read latest block</span>
    publicClient.<span class="keyword">getBlockNumber</span>(),
    <span class="comment">// Compute: confirm broker can mint a token</span>
    broker.inference.<span class="keyword">listProviders</span>(),
    <span class="comment">// KV / DA: optional pings</span>
  ]);
  <span class="keyword">const</span> ok = checks.<span class="keyword">every</span>(c =&gt; c.status === <span class="string">'fulfilled'</span>);
  <span class="keyword">return</span> Response.<span class="keyword">json</span>({ status: ok ? <span class="string">'ok'</span> : <span class="string">'degraded'</span>, checks });
}</pre>

  <h2 style="margin-top:32px">Patterns Coal uses in production</h2>

  <h3>1. Receipt trail on every payment</h3>
  <p>Each successful checkout produces: Base USDC tx → 0G Storage upload (receipt JSON) → 0G Chain anchor (SHA-256 of payload). Surface all three on the receipt page so buyers can independently verify.</p>

  <h3>2. Agent-discoverable catalog</h3>
  <p>Publish your product list as JSON to <span class="mono">/llms.txt</span>, <span class="mono">/.well-known/agent-card.json</span>, and <span class="mono">/.well-known/x402.json</span>. Coal's <span class="mono">CoalAgentPublisher</span> React component does all three at build time.</p>

  <h3>3. Per-call x402 paywalls</h3>
  <p>For paid APIs (oracles, scrapers, paid datasets), gate every request behind an HTTP 402 response carrying x402 payment requirements. The agent signs an EIP-3009 authorization, posts to the verify endpoint, gets the data. Coal facilitates settlement on Base — your endpoint stays purely a content server.</p>

  <h3>4. Memory queries via 0G Compute</h3>
  <p>Treat 0G Compute as your memory query layer. Index your products + policies into a vector index, store the index on 0G Storage, and answer agent questions with sealed inference — the LLM provider can't see your raw data.</p>
</section>

<!-- PAGE 6: RESOURCES -->
<section class="page">
  <header>
    <span>0G Cheatsheet</span>
    <span>06 / Resources</span>
  </header>
  <h2>Resources</h2>
  <p class="lede">The links you'll bookmark on day 1 and never close.</p>

  <h3>Official 0G</h3>
  <ul>
    <li><strong>Homepage:</strong> <a href="https://0g.ai">https://0g.ai</a></li>
    <li><strong>Docs:</strong> <a href="https://docs.0g.ai">https://docs.0g.ai</a></li>
    <li><strong>Explorer:</strong> <a href="https://chainscan.0g.ai">https://chainscan.0g.ai</a></li>
    <li><strong>Storage Scan:</strong> <a href="https://storagescan.0g.ai">https://storagescan.0g.ai</a></li>
    <li><strong>Faucet (testnet):</strong> <a href="https://faucet.0g.ai">https://faucet.0g.ai</a></li>
    <li><strong>X / Twitter:</strong> <a href="https://x.com/0G_labs">@0G_labs</a> / <a href="https://x.com/0g_eco">@0g_Eco</a></li>
  </ul>

  <h3>Coal (this book's publisher)</h3>
  <ul>
    <li><strong>Coal homepage:</strong> <a href="https://usecoal.xyz">https://usecoal.xyz</a></li>
    <li><strong>Live agent demo:</strong> <a href="https://agent.usecoal.xyz">https://agent.usecoal.xyz</a></li>
    <li><strong>x402 paywall demo:</strong> <a href="https://oracle.usecoal.xyz/api/price/ETH">oracle.usecoal.xyz/api/price/ETH</a></li>
    <li><strong>MCP server:</strong> <a href="https://mcp.usecoal.xyz/api/mcp">mcp.usecoal.xyz/api/mcp</a></li>
    <li><strong>0G health:</strong> <a href="https://api.usecoal.xyz/api/0g/health">api.usecoal.xyz/api/0g/health</a></li>
    <li><strong>SDKs:</strong> <span class="mono">npm i coal-react</span> · <span class="mono">npm i create-0g-dapp</span></li>
  </ul>

  <h3>Standards Coal speaks natively</h3>
  <ul>
    <li><strong>x402 (Coinbase):</strong> <a href="https://x402.org">x402.org</a> — HTTP 402 + signed authorization for agent payments</li>
    <li><strong>OKX APP:</strong> <a href="https://github.com/okx/payments">github.com/okx/payments</a> — x402 v2 envelope, byte-compatible with EIP-3009</li>
    <li><strong>EIP-3009:</strong> <a href="https://eips.ethereum.org/EIPS/eip-3009">eips.ethereum.org/EIPS/eip-3009</a> — gasless USDC transfers</li>
    <li><strong>MCP:</strong> <a href="https://modelcontextprotocol.io">modelcontextprotocol.io</a> — Anthropic's tool-use protocol for AI agents</li>
  </ul>

  <h3>Hackathon-ready starters</h3>
  <ul>
    <li><span class="mono">npx create-0g-dapp my-app</span> — Coal's CLI scaffolds a Next.js app with all 0G primitives wired up</li>
    <li><span class="mono">npm i coal-react</span> — drop-in React components for checkout, paywalls, agent-discoverable catalogs</li>
    <li><span class="mono">/examples/coal-agent</span> — reference autonomous-buyer implementation</li>
    <li><span class="mono">/examples/coal-mcp-server</span> — reference MCP server with 12 tools for Claude/Cursor</li>
  </ul>

  <div class="footer-bar">
    Published by Coal · usecoal.xyz · 2026<br/>
    The cheatsheet is updated as 0G ships. You bought the latest version. Updates free for life.
  </div>
</section>

</body>
</html>
`;

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  console.log('Launching headless Chromium…');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  await page.setContent(HTML, { waitUntil: 'networkidle0' });
  await page.evaluateHandle('document.fonts.ready');
  await new Promise((r) => setTimeout(r, 1500));

  console.log('Rendering PDF…');
  await page.pdf({
    path: OUT_PATH,
    format: 'A4',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    preferCSSPageSize: false,
  });

  await browser.close();

  const size = (await fs.stat(OUT_PATH)).size;
  console.log(`✓ Wrote ${OUT_PATH} (${(size / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error('Failed to generate PDF:', err);
  process.exit(1);
});
