import { createPublicClient, http, isAddress } from 'viem';
import { base } from 'viem/chains';

// Chainalysis Sanctions Oracle on Base
const SANCTIONS_ORACLE = '0x40C57923924B5c5c5455c48D93317139ADDaC8fb' as const;

const ORACLE_ABI = [{
  name: 'isSanctioned',
  type: 'function' as const,
  stateMutability: 'view' as const,
  inputs: [{ name: 'addr', type: 'address' }],
  outputs: [{ name: '', type: 'bool' }],
}] as const;

const publicClient = createPublicClient({
  chain: base,
  transport: http(process.env.ALCHEMY_RPC_URL || 'https://mainnet.base.org'),
});

export async function isAddressSanctioned(address: string): Promise<boolean> {
  if (!isAddress(address)) return false;
  try {
    return await publicClient.readContract({
      address: SANCTIONS_ORACLE,
      abi: ORACLE_ABI,
      functionName: 'isSanctioned',
      args: [address as `0x${string}`],
    });
  } catch {
    // Fail open — don't block payments if oracle is unavailable
    return false;
  }
}

export async function checkSanctions(addresses: string[]): Promise<{ sanctioned: boolean; address?: string }> {
  for (const addr of addresses) {
    if (await isAddressSanctioned(addr)) {
      return { sanctioned: true, address: addr };
    }
  }
  return { sanctioned: false };
}
