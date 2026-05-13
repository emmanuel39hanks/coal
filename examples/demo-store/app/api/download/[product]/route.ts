/**
 * Protected download endpoint for digital products.
 *
 * GET /api/download/0g-cheatsheet?session_id=cs_xxx
 *
 * Flow:
 *   1. Lookup the receipt for the checkout session via Coal API.
 *   2. If status === 'confirmed' AND the verified payment matches what we
 *      expect (this product, this merchant), serve the file.
 *   3. Otherwise return 402 Payment Required with a hint.
 *
 * The verification chain (Base tx → 0G Storage → 0G Chain anchor) is what
 * makes the gate trustworthy: we don't accept the buyer's word that they
 * paid — we re-fetch the receipt from Coal, which itself re-checks the
 * on-chain transfer and the receipt anchor.
 *
 * Why session-id-as-key (not Bearer token): the Coal checkout flow returns a
 * `session_id` that uniquely identifies one paid transaction. Anyone with
 * that id has access to that one paid item — exactly the semantics digital
 * goods need. No JWT, no DB rows, no auth flow.
 */

import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const COAL_API_URL = process.env.COAL_API_URL || 'https://api.usecoal.xyz';
const BASE_RPC = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
// ERC-20 Transfer event signature (topic0)
const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const DOWNLOAD_SIGNING_SECRET = process.env.DOWNLOAD_SIGNING_SECRET || '';
const DOWNLOAD_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Two-step download flow:
 *   1. Caller passes ?tx_hash=… or ?session_id=… — server verifies on-chain /
 *      via Coal receipts and issues a signed token with 10 min expiry.
 *   2. Caller hits the same URL with ?token=… — server validates HMAC + expiry,
 *      then streams the file.
 *
 * Why: the tx_hash is visible in the Claude chat log / demo video. Without
 * expiry, anyone watching the recording could replay the URL forever. With
 * expiry, the leaked link expires before any meaningful redistribution.
 *
 * The signing secret is server-only. Tokens are stateless (no DB) — the HMAC
 * is the source of truth.
 */
function signToken(payload: { product: string; expires: number; payer?: string; tx?: string }): string {
    const data = `${payload.product}|${payload.expires}|${payload.payer || ''}|${payload.tx || ''}`;
    if (!DOWNLOAD_SIGNING_SECRET) throw new Error('DOWNLOAD_SIGNING_SECRET not configured');
    const sig = crypto.createHmac('sha256', DOWNLOAD_SIGNING_SECRET).update(data).digest('hex');
    return Buffer.from(`${payload.expires}.${payload.payer || ''}.${payload.tx || ''}.${sig}`, 'utf-8').toString('base64url');
}

function verifyToken(token: string, product: string): { ok: boolean; payer?: string; tx?: string; reason?: string } {
    if (!DOWNLOAD_SIGNING_SECRET) return { ok: false, reason: 'server not configured' };
    let decoded: string;
    try {
        decoded = Buffer.from(token, 'base64url').toString('utf-8');
    } catch {
        return { ok: false, reason: 'malformed token' };
    }
    const parts = decoded.split('.');
    if (parts.length !== 4) return { ok: false, reason: 'malformed token' };
    const [expiresStr, payer, tx, sig] = parts;
    const expires = parseInt(expiresStr, 10);
    if (!Number.isFinite(expires)) return { ok: false, reason: 'malformed token expiry' };
    if (Date.now() > expires) return { ok: false, reason: 'token expired' };

    const expected = crypto
        .createHmac('sha256', DOWNLOAD_SIGNING_SECRET)
        .update(`${product}|${expires}|${payer || ''}|${tx || ''}`)
        .digest('hex');
    if (sig.length !== expected.length) return { ok: false, reason: 'signature length mismatch' };
    try {
        if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) {
            return { ok: false, reason: 'signature mismatch' };
        }
    } catch {
        return { ok: false, reason: 'signature comparison failed' };
    }
    return { ok: true, payer, tx };
}

interface ProductFile {
    file: string;
    contentType: string;
    filename: string;
    /** Minimum amount paid (USD) for this download to unlock. */
    minPriceUsd: number;
    /** Optional friendly product name for receipts. */
    label: string;
    /** Merchant payout address that must receive the payment. */
    payTo: string;
}

const PRODUCTS: Record<string, ProductFile> = {
    '0g-cheatsheet': {
        file: '0g-builders-cheatsheet.pdf',
        contentType: 'application/pdf',
        filename: '0G-Builders-Cheatsheet.pdf',
        minPriceUsd: 0.10,
        label: "The 0G Builder's Cheatsheet",
        // Saint's payout address (the merchant who sells this on Coal)
        payTo: '0xc495953de50ac375e3c564f4acd4cc48949576ae',
    },
};

interface CoalReceipt {
    checkoutId: string;
    status: string;
    verified: boolean;
    payment?: {
        amount: string;
        currency: string;
        txHash: string;
    };
    proofTrail?: {
        storage?: { storageRoot: string } | null;
        chain?: { anchorTxHash: string } | null;
    } | null;
}

async function fetchReceipt(sessionId: string): Promise<CoalReceipt | null> {
    try {
        const res = await fetch(`${COAL_API_URL}/api/receipts/${encodeURIComponent(sessionId)}`, {
            headers: { accept: 'application/json' },
            cache: 'no-store',
        });
        if (!res.ok) return null;
        return (await res.json()) as CoalReceipt;
    } catch {
        return null;
    }
}

interface TxVerifyResult {
    ok: boolean;
    amountUsd?: number;
    payer?: string;
    recipient?: string;
    reason?: string;
}

/**
 * Verify a Base USDC transfer happened by reading the transaction receipt.
 * Used when the buyer paid via `pay_merchant` (which gives a tx hash, not a
 * Coal session id). Decodes the ERC-20 Transfer event log and checks
 * recipient + amount.
 */
async function verifyTxOnChain(txHash: string, expectedRecipient: string): Promise<TxVerifyResult> {
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        return { ok: false, reason: 'tx hash must be 0x + 64 hex chars' };
    }
    try {
        const res = await fetch(BASE_RPC, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [txHash],
            }),
        });
        const json = await res.json() as { result?: { status: string; logs: Array<{ address: string; topics: string[]; data: string }> } };
        const receipt = json.result;
        if (!receipt) return { ok: false, reason: 'tx not found on Base' };
        if (receipt.status !== '0x1') return { ok: false, reason: 'tx reverted on chain' };

        const transfer = receipt.logs.find((l) =>
            l.address.toLowerCase() === USDC_ADDRESS.toLowerCase() &&
            l.topics[0] === ERC20_TRANSFER_TOPIC,
        );
        if (!transfer) return { ok: false, reason: 'no USDC Transfer event in this tx' };

        const payer = '0x' + transfer.topics[1].slice(-40);
        const recipient = '0x' + transfer.topics[2].slice(-40);
        const amountRaw = BigInt(transfer.data);
        const amountUsd = Number(amountRaw) / 1e6;

        if (recipient.toLowerCase() !== expectedRecipient.toLowerCase()) {
            return {
                ok: false,
                reason: `tx paid ${recipient}, expected ${expectedRecipient}`,
                payer, recipient, amountUsd,
            };
        }
        return { ok: true, payer, recipient, amountUsd };
    } catch (err) {
        return { ok: false, reason: err instanceof Error ? err.message : 'on-chain lookup failed' };
    }
}

function deny(reason: string, hint: string, status = 402) {
    return Response.json({ error: reason, hint }, { status });
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ product: string }> },
) {
    const { product } = await params;
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('session_id') || url.searchParams.get('sessionId');
    const txHash = url.searchParams.get('tx_hash') || url.searchParams.get('txHash');
    const token = url.searchParams.get('token');

    const cfg = PRODUCTS[product];
    if (!cfg) {
        return Response.json({ error: 'Unknown product', available: Object.keys(PRODUCTS) }, { status: 404 });
    }

    // Path C: short-lived signed token (the only path that actually serves bytes)
    if (token) {
        const v = verifyToken(token, product);
        if (!v.ok) {
            return deny(
                'Download token invalid or expired',
                `${v.reason || 'unknown'}. Re-fetch the URL by passing ?tx_hash=… or ?session_id=… and a fresh token will be issued.`,
                401,
            );
        }
        const filePath = path.join(process.cwd(), 'public', 'downloads', cfg.file);
        let bytes: Buffer;
        try {
            await stat(filePath);
            bytes = await readFile(filePath);
        } catch {
            return Response.json({ error: 'File missing on server', product }, { status: 500 });
        }
        return new Response(bytes as unknown as BodyInit, {
            status: 200,
            headers: {
                'content-type': cfg.contentType,
                'content-disposition': `attachment; filename="${cfg.filename}"`,
                'cache-control': 'private, no-store',
                'x-coal-tx-hash': v.tx || '',
                'x-coal-payer': v.payer || '',
            },
        });
    }

    if (!sessionId && !txHash) {
        return deny(
            'Payment required',
            'Pass ?session_id=YOUR_CHECKOUT_ID (from store success page) OR ?tx_hash=0x... (from pay_merchant). Buy at https://store.usecoal.xyz or via the Coal MCP.',
        );
    }

    if (!DOWNLOAD_SIGNING_SECRET) {
        return Response.json({
            error: 'Server not configured',
            hint: 'DOWNLOAD_SIGNING_SECRET env var is required to issue download tokens.',
        }, { status: 500 });
    }

    let txHashForHeaders = '';
    let storageRoot = '';
    let chainAnchor = '';
    let payer = '';

    // Path A: paid via Coal checkout — verify via Coal receipt
    if (sessionId) {
        const receipt = await fetchReceipt(sessionId);
        if (!receipt) {
            return deny('Receipt not found', `Coal returned no receipt for session ${sessionId}.`, 404);
        }
        if (!receipt.verified || receipt.status !== 'confirmed') {
            return deny(
                'Payment not confirmed',
                `Session ${sessionId} is in status "${receipt.status}". Wait ~30s after paying — Coal needs ≥2 block confirmations.`,
            );
        }
        const paid = parseFloat(receipt.payment?.amount || '0');
        if (paid < cfg.minPriceUsd) {
            return deny(
                'Insufficient payment',
                `This product requires $${cfg.minPriceUsd.toFixed(2)} but session ${sessionId} only paid $${paid.toFixed(2)}.`,
            );
        }
        txHashForHeaders = receipt.payment?.txHash || '';
        storageRoot = receipt.proofTrail?.storage?.storageRoot || '';
        chainAnchor = receipt.proofTrail?.chain?.anchorTxHash || '';
    } else if (txHash) {
        // Path B: paid via pay_merchant (no Coal session) — verify on-chain directly
        const v = await verifyTxOnChain(txHash, cfg.payTo);
        if (!v.ok) {
            return deny('Payment not verified', v.reason || 'on-chain check failed');
        }
        if ((v.amountUsd ?? 0) < cfg.minPriceUsd) {
            return deny(
                'Insufficient payment',
                `Tx paid $${(v.amountUsd ?? 0).toFixed(2)}, need $${cfg.minPriceUsd.toFixed(2)}.`,
            );
        }
        txHashForHeaders = txHash;
        payer = v.payer || '';
    }

    // Issue a 10-minute signed token. The caller redirects (or the success
    // page renders the new URL). Direct downloads via tx_hash/sessionId never
    // serve bytes — always redirect to a token URL.
    const expires = Date.now() + DOWNLOAD_TOKEN_TTL_MS;
    const issuedToken = signToken({ product, expires, payer, tx: txHashForHeaders });
    const downloadUrl = `${url.origin}${url.pathname}?token=${encodeURIComponent(issuedToken)}`;

    // If the caller wants JSON (agent path), return the URL + metadata so the
    // agent can hand it to the user. Browsers (Accept: text/html) get a 302.
    const wantsJson = (request.headers.get('accept') || '').includes('application/json');
    if (wantsJson) {
        return Response.json({
            ok: true,
            product,
            downloadUrl,
            expiresAt: new Date(expires).toISOString(),
            ttlSeconds: Math.floor(DOWNLOAD_TOKEN_TTL_MS / 1000),
            proof: {
                txHash: txHashForHeaders,
                payer,
                storageRoot,
                chainAnchor,
            },
        });
    }
    return Response.redirect(downloadUrl, 302);
}
