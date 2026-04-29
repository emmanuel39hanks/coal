/**
 * Auto-refreshing 0G Compute API key.
 *
 * The 0G Compute API key (`app-sk-...`) is a signed JWT-like token that expires
 * after ~24h. Hardcoding it in env vars breaks after a day. This module uses the
 * broker SDK to mint fresh tokens on demand and caches them in module memory.
 *
 * Usage:
 *   const apiKey = await getZeroGComputeApiKey();
 *   const openai = new OpenAI({ apiKey, baseURL: '...' });
 */

import { Wallet, JsonRpcProvider } from 'ethers';

interface CachedToken {
  apiKey: string;
  expiresAt: number; // ms epoch
}

let cached: CachedToken | null = null;
let inflight: Promise<string> | null = null;

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

function decodeExpiry(apiKey: string): number {
  // Token format: app-sk-<base64payload>|<hex_signature>
  // Payload is JSON with `expiresAt` (ms epoch).
  try {
    const stripped = apiKey.replace(/^app-sk-/, '');
    const payloadB64 = stripped.split('|')[0];
    const json = Buffer.from(payloadB64, 'base64').toString();
    const decoded = JSON.parse(json) as { expiresAt?: number };
    if (typeof decoded.expiresAt === 'number') return decoded.expiresAt;
  } catch {
    // fall through
  }
  // Default: assume 23h validity
  return Date.now() + 23 * 60 * 60 * 1000;
}

async function fetchFreshToken(): Promise<string> {
  const privateKey = process.env.OPERATOR_PRIVATE_KEY || process.env.ZERO_G_CHAIN_PRIVATE_KEY;
  const providerAddress = process.env.ZERO_G_COMPUTE_PROVIDER;
  const rpcUrl = process.env.ZERO_G_CHAIN_RPC_URL || 'https://evmrpc.0g.ai';

  if (!privateKey) {
    throw new Error('Cannot refresh 0G Compute token: OPERATOR_PRIVATE_KEY (or ZERO_G_CHAIN_PRIVATE_KEY) not set');
  }
  if (!providerAddress) {
    throw new Error('Cannot refresh 0G Compute token: ZERO_G_COMPUTE_PROVIDER not set');
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(privateKey, provider);

  // Dynamic import to keep cold-start light
  const { createZGComputeNetworkBroker } = await import('@0glabs/0g-serving-broker');
  const broker = await createZGComputeNetworkBroker(wallet);

  const headers = await broker.inference.getRequestHeaders(providerAddress as `0x${string}`);
  const headersObj = headers as unknown as Record<string, string>;
  const auth = headersObj.Authorization || headersObj.authorization || '';
  const apiKey = auth.replace(/^Bearer\s+/i, '').trim();

  if (!apiKey) {
    throw new Error('0G broker returned empty Authorization header');
  }

  return apiKey;
}

/**
 * Get a valid 0G Compute API key. Uses cache if still valid, otherwise refreshes.
 *
 * Falls back to OPENAI_API_KEY env var if broker refresh fails AND that var is set.
 */
export async function getZeroGComputeApiKey(): Promise<string> {
  // Cache hit
  if (cached && Date.now() < cached.expiresAt - REFRESH_BUFFER_MS) {
    return cached.apiKey;
  }

  // De-dup concurrent refreshes
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const apiKey = await fetchFreshToken();
      const expiresAt = decodeExpiry(apiKey);
      cached = { apiKey, expiresAt };
      return apiKey;
    } catch (err) {
      // Fall back to a static env var token if available (legacy / debug path)
      const fallback = process.env.OPENAI_API_KEY;
      if (fallback && fallback.startsWith('app-sk-')) {
        const expiresAt = decodeExpiry(fallback);
        if (Date.now() < expiresAt - REFRESH_BUFFER_MS) {
          cached = { apiKey: fallback, expiresAt };
          return fallback;
        }
      }
      throw err;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function clearZeroGTokenCache() {
  cached = null;
}
