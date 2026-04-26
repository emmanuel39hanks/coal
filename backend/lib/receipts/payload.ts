import { createHash } from 'node:crypto';
import { CHAIN, CHAIN_ID, EXPLORER_URL, getSettlementToken } from '@/lib/chain';
import { getChainByKey, type SupportedChainKey } from '@/lib/chains';
import type { ReceiptPayload } from '@/lib/0g/types';

function stableValue(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(stableValue);
    }

    if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
        return Object.keys(value as Record<string, unknown>)
            .sort()
            .reduce<Record<string, unknown>>((accumulator, key) => {
                accumulator[key] = stableValue((value as Record<string, unknown>)[key]);
                return accumulator;
            }, {});
    }

    return value;
}

export function canonicalJson(value: unknown) {
    return JSON.stringify(stableValue(value));
}

export function sha256Hex(value: string | Uint8Array) {
    return `0x${createHash('sha256').update(value).digest('hex')}` as `0x${string}`;
}

export interface ReceiptPayloadInput {
    session: {
        id: string;
        merchantId: string;
        amount: { toString(): string };
        currency: string;
        description?: string | null;
        metadata?: unknown;
        createdAt: Date;
        /** World-3: which chain this session settled on. Defaults to 'base' for legacy rows. */
        settlementChain?: SupportedChainKey | string | null;
    };
    merchant: {
        id: string;
        name?: string | null;
        email?: string | null;
        payoutAddress?: string | null;
    };
    transaction: {
        txHash: string;
        from: string;
        to: string;
        amount: string;
        status: string;
        blockNumber?: number | null;
        confirmedAt?: Date | string | null;
    };
}

function resolveChainForReceipt(raw: ReceiptPayloadInput['session']['settlementChain']) {
    if (raw === 'worldchain') {
        const cfg = getChainByKey('worldchain');
        return {
            id: cfg.chainId,
            name: cfg.displayName,
            explorerBase: cfg.explorerUrl,
            settlementToken: {
                address: cfg.usdc.address as string,
                symbol: cfg.usdc.symbol as string,
                name: cfg.usdc.name,
                decimals: cfg.usdc.decimals,
            },
        };
    }

    // Default: Base via the legacy chain module (preserves the
    // configured custom settlement token path if set).
    const settlementToken = getSettlementToken();
    return {
        id: CHAIN_ID,
        name: CHAIN.name,
        explorerBase: EXPLORER_URL,
        settlementToken: {
            address: settlementToken.address as string,
            symbol: settlementToken.symbol,
            name: settlementToken.name,
            decimals: settlementToken.decimals,
        },
    };
}

export function buildReceiptPayload(input: ReceiptPayloadInput): ReceiptPayload {
    const chain = resolveChainForReceipt(input.session.settlementChain);

    return {
        version: 'coal.receipt.v1',
        kind: 'receipt_payload',
        receiptId: `receipt_${input.session.id}`,
        checkoutSessionId: input.session.id,
        merchantId: input.merchant.id,
        merchantName: input.merchant.name || null,
        merchantEmail: input.merchant.email || null,
        payoutAddress: input.merchant.payoutAddress || null,
        amount: input.session.amount.toString(),
        currency: input.session.currency,
        description: input.session.description || null,
        settlementToken: chain.settlementToken,
        chain: {
            id: chain.id,
            name: chain.name,
            explorerUrl: `${chain.explorerBase}/tx/${input.transaction.txHash}`,
        },
        transaction: {
            hash: input.transaction.txHash,
            from: input.transaction.from,
            to: input.transaction.to,
            amount: input.transaction.amount,
            blockNumber: input.transaction.blockNumber ?? null,
            status: input.transaction.status,
        },
        metadata:
            input.session.metadata && typeof input.session.metadata === 'object'
                ? (input.session.metadata as Record<string, unknown>)
                : null,
        createdAt: input.session.createdAt.toISOString(),
        confirmedAt: input.transaction.confirmedAt
            ? new Date(input.transaction.confirmedAt).toISOString()
            : new Date().toISOString(),
    };
}

export function hashReceiptPayload(payload: ReceiptPayload) {
    return sha256Hex(canonicalJson(payload));
}

export function buildReceiptSubjectHash(input: {
    merchantId: string;
    sessionId: string;
    txHash: string;
}) {
    return sha256Hex(`${input.merchantId}:${input.sessionId}:${input.txHash.toLowerCase()}`);
}

export function normalizeArtifactRoot(rootHash: string) {
    if (/^0x[a-fA-F0-9]{64}$/.test(rootHash)) {
        return rootHash.toLowerCase() as `0x${string}`;
    }

    return sha256Hex(rootHash);
}
