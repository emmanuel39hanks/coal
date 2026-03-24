import { verifyTypedData } from 'viem';
import { CHAIN_ID } from '@/lib/chain';

export const COAL_DOMAIN = {
    name: 'Coal Payment Protocol',
    version: '1',
    chainId: CHAIN_ID,
    verifyingContract: '0x0000000000000000000000000000000000000000' as `0x${string}`,
} as const;

export const PAYMENT_TYPES = {
    PaymentAuthorization: [
        { name: 'sessionId',  type: 'string'  },
        { name: 'amount',     type: 'uint256' },
        { name: 'token',      type: 'address' },
        { name: 'recipient',  type: 'address' },
        { name: 'nonce',      type: 'uint256' },
        { name: 'deadline',   type: 'uint256' },
    ],
} as const;

export interface PaymentMessage {
    sessionId: string;
    amount:    bigint;
    token:     `0x${string}`;
    recipient: `0x${string}`;
    nonce:     bigint;
    deadline:  bigint;
}

export async function verifyPaymentSignature(
    message: PaymentMessage,
    signature: `0x${string}`,
    expectedSigner: `0x${string}`
): Promise<boolean> {
    try {
        return await verifyTypedData({
            address: expectedSigner,
            domain: COAL_DOMAIN,
            types: PAYMENT_TYPES,
            primaryType: 'PaymentAuthorization',
            message,
            signature,
        });
    } catch {
        return false;
    }
}
