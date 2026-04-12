/**
 * Price data fetchers for crypto (CoinGecko) and stocks (Yahoo Finance).
 *
 * Both APIs are free-tier, no API key required. CoinGecko has a 30 req/min
 * limit on the free plan. Yahoo Finance has no documented rate limit but
 * aggressive use will get IP-blocked.
 *
 * Results are cached for 10 seconds to avoid hammering upstream APIs when
 * multiple agents query the same ticker in quick succession.
 */

export interface PriceResult {
    symbol: string;
    name: string;
    price: number;
    currency: string;
    change24h?: number;
    changePercent24h?: number;
    marketCap?: number;
    volume24h?: number;
    source: string;
    type: 'crypto' | 'stock';
    timestamp: string;
}

// ─── Simple in-memory cache (10s TTL) ────────────────────────────────────────

const cache = new Map<string, { data: PriceResult; expiresAt: number }>();
const CACHE_TTL_MS = 10_000;

function getCached(key: string): PriceResult | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}

function setCache(key: string, data: PriceResult) {
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── Crypto (CoinGecko) ─────────────────────────────────────────────────────

// Map common ticker symbols to CoinGecko IDs
const CRYPTO_ID_MAP: Record<string, string> = {
    btc: 'bitcoin',
    eth: 'ethereum',
    sol: 'solana',
    usdc: 'usd-coin',
    usdt: 'tether',
    bnb: 'binancecoin',
    xrp: 'ripple',
    ada: 'cardano',
    doge: 'dogecoin',
    dot: 'polkadot',
    avax: 'avalanche-2',
    matic: 'matic-network',
    link: 'chainlink',
    uni: 'uniswap',
    atom: 'cosmos',
    near: 'near',
    apt: 'aptos',
    arb: 'arbitrum',
    op: 'optimism',
    sui: 'sui',
    '0g': 'zero-gravity',
};

// Known crypto symbols (used to decide crypto vs stock)
const KNOWN_CRYPTO = new Set(Object.keys(CRYPTO_ID_MAP));

export function isCrypto(symbol: string): boolean {
    return KNOWN_CRYPTO.has(symbol.toLowerCase());
}

export async function getCryptoPrice(symbol: string): Promise<PriceResult> {
    const key = `crypto:${symbol.toLowerCase()}`;
    const cached = getCached(key);
    if (cached) return cached;

    const id = CRYPTO_ID_MAP[symbol.toLowerCase()] || symbol.toLowerCase();

    const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`,
        { headers: { accept: 'application/json' } },
    );

    if (!res.ok) {
        throw new Error(`CoinGecko returned ${res.status} for "${id}". Try a different symbol.`);
    }

    const data = await res.json();
    const md = data.market_data;

    const result: PriceResult = {
        symbol: symbol.toUpperCase(),
        name: data.name,
        price: md.current_price.usd,
        currency: 'USD',
        change24h: md.price_change_24h,
        changePercent24h: md.price_change_percentage_24h,
        marketCap: md.market_cap.usd,
        volume24h: md.total_volume.usd,
        source: 'coingecko',
        type: 'crypto',
        timestamp: new Date().toISOString(),
    };

    setCache(key, result);
    return result;
}

// ─── Stocks (Yahoo Finance) ──────────────────────────────────────────────────

export async function getStockPrice(symbol: string): Promise<PriceResult> {
    const key = `stock:${symbol.toUpperCase()}`;
    const cached = getCached(key);
    if (cached) return cached;

    const ticker = symbol.toUpperCase();
    const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=2d`,
        {
            headers: {
                accept: 'application/json',
                'user-agent': 'Coal-Oracle/1.0',
            },
        },
    );

    if (!res.ok) {
        throw new Error(`Yahoo Finance returned ${res.status} for "${ticker}". Try a different symbol.`);
    }

    const data = await res.json();
    const meta = data.chart?.result?.[0]?.meta;

    if (!meta) {
        throw new Error(`No data found for stock symbol "${ticker}".`);
    }

    const currentPrice = meta.regularMarketPrice;
    const previousClose = meta.chartPreviousClose || meta.previousClose;
    const change = previousClose ? currentPrice - previousClose : undefined;
    const changePct = previousClose ? ((currentPrice - previousClose) / previousClose) * 100 : undefined;

    const result: PriceResult = {
        symbol: ticker,
        name: meta.shortName || meta.longName || ticker,
        price: currentPrice,
        currency: meta.currency || 'USD',
        change24h: change ? Math.round(change * 100) / 100 : undefined,
        changePercent24h: changePct ? Math.round(changePct * 100) / 100 : undefined,
        marketCap: meta.marketCap,
        volume24h: meta.regularMarketVolume,
        source: 'yahoo-finance',
        type: 'stock',
        timestamp: new Date().toISOString(),
    };

    setCache(key, result);
    return result;
}

// ─── Unified fetcher ─────────────────────────────────────────────────────────

export async function getPrice(symbol: string): Promise<PriceResult> {
    if (isCrypto(symbol)) {
        return getCryptoPrice(symbol);
    }
    // Try stock first, fall back to CoinGecko for unknown crypto tokens
    try {
        return await getStockPrice(symbol);
    } catch {
        return getCryptoPrice(symbol);
    }
}
