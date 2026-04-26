import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

describe('backend/lib/chains', () => {
    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
        // Strip any vars the test is about to assert on.
        delete process.env.CHAIN_ENV;
        delete process.env.WORLD_CHAIN_ENABLED;
        delete process.env.WORLD_CHAIN_RECEIPT_ANCHOR_ADDRESS;
        delete process.env.WORLD_CHAIN_SEPOLIA_RECEIPT_ANCHOR_ADDRESS;
        delete process.env.DEFAULT_SETTLEMENT_CHAIN;
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it('maps base + worldchain to mainnet IDs by default', async () => {
        const { getChainByKey } = await import('@/lib/chains');
        expect(getChainByKey('base').chainId).toBe(8453);
        expect(getChainByKey('worldchain').chainId).toBe(480);
    });

    it('flips both chains to sepolia when CHAIN_ENV=testnet', async () => {
        process.env.CHAIN_ENV = 'testnet';
        const { getChainByKey } = await import('@/lib/chains');
        expect(getChainByKey('base').chainId).toBe(84532);
        expect(getChainByKey('worldchain').chainId).toBe(4801);
    });

    it('uses the canonical World Chain USDC address on mainnet', async () => {
        const { getChainByKey } = await import('@/lib/chains');
        const cfg = getChainByKey('worldchain');
        expect(cfg.usdc.address.toLowerCase()).toBe(
            '0x79a02482a880bce3f13e09da970dc34db4cd24d1',
        );
        expect(cfg.usdc.decimals).toBe(6);
    });

    it('Base anchor is null (receipts anchor on 0G, not Base)', async () => {
        const { getChainByKey } = await import('@/lib/chains');
        expect(getChainByKey('base').receiptAnchor).toBeNull();
    });

    it('World Chain anchor reads from the right env var per CHAIN_ENV', async () => {
        process.env.WORLD_CHAIN_RECEIPT_ANCHOR_ADDRESS = '0x1234567890123456789012345678901234567890';
        const mainnetMod = await import('@/lib/chains');
        expect(mainnetMod.getChainByKey('worldchain').receiptAnchor?.toLowerCase())
            .toBe('0x1234567890123456789012345678901234567890');

        vi.resetModules();
        process.env = { ...originalEnv };
        process.env.CHAIN_ENV = 'testnet';
        process.env.WORLD_CHAIN_SEPOLIA_RECEIPT_ANCHOR_ADDRESS = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
        const sepoliaMod = await import('@/lib/chains');
        expect(sepoliaMod.getChainByKey('worldchain').receiptAnchor?.toLowerCase())
            .toBe('0xabcdefabcdefabcdefabcdefabcdefabcdefabcd');
    });

    it('rejects malformed World Chain anchor addresses', async () => {
        process.env.WORLD_CHAIN_RECEIPT_ANCHOR_ADDRESS = 'not-an-address';
        const { getChainByKey } = await import('@/lib/chains');
        expect(getChainByKey('worldchain').receiptAnchor).toBeNull();
    });

    it('getChainByChainId returns the matching config', async () => {
        const { getChainByChainId } = await import('@/lib/chains');
        expect(getChainByChainId(8453)?.key).toBe('base');
        expect(getChainByChainId(480)?.key).toBe('worldchain');
        expect(getChainByChainId(1)).toBeNull();
    });

    it('isSupportedChainKey / resolveChainKey gate unknown values', async () => {
        const { isSupportedChainKey, resolveChainKey } = await import('@/lib/chains');
        expect(isSupportedChainKey('base')).toBe(true);
        expect(isSupportedChainKey('worldchain')).toBe(true);
        expect(isSupportedChainKey('ethereum')).toBe(false);
        expect(isSupportedChainKey(null)).toBe(false);

        expect(resolveChainKey('base')).toBe('base');
        expect(resolveChainKey('worldchain')).toBe('worldchain');
        expect(resolveChainKey('ethereum')).toBe('base');
        expect(resolveChainKey(undefined)).toBe('base');
        expect(resolveChainKey(null)).toBe('base');
    });

    it('getDefaultChainKey honors DEFAULT_SETTLEMENT_CHAIN', async () => {
        const { getDefaultChainKey } = await import('@/lib/chains');
        expect(getDefaultChainKey()).toBe('base');

        vi.resetModules();
        process.env.DEFAULT_SETTLEMENT_CHAIN = 'worldchain';
        const mod = await import('@/lib/chains');
        expect(mod.getDefaultChainKey()).toBe('worldchain');
    });
});
