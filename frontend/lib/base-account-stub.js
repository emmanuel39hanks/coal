/**
 * Stub for @base-org/account — replaces the real SDK to prevent Privy's
 * base_account connector from calling setWalletProvider with a broken provider.
 * The stub returns an EIP-1193 compliant provider (with .on/.removeListener)
 * so Privy's event subscription wiring doesn't throw.
 */

function createNoopProvider() {
  const listeners = {};
  return {
    request: async ({ method }) => {
      if (method === 'eth_accounts') return [];
      if (method === 'eth_chainId') return '0x2105'; // Base mainnet
      throw new Error(`base_account stub: unsupported method ${method}`);
    },
    on(event, listener) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(listener);
    },
    removeListener(event, listener) {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(l => l !== listener);
      }
    },
  };
}

export function createBaseAccountSDK(_options) {
  const provider = createNoopProvider();
  return {
    getProvider: () => provider,
    subAccount: {
      create: async () => { throw new Error('base_account stub: not implemented'); },
      get: async () => null,
    },
  };
}
