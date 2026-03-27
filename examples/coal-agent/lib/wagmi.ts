import { createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { injected, coinbaseWallet } from 'wagmi/connectors';

export const config = createConfig({
  chains: [base],
  connectors: [
    injected(),
    coinbaseWallet({ appName: 'Coal Agent', preference: 'smartWalletOnly' }),
  ],
  transports: {
    [base.id]: http(),
  },
  ssr: true,
});
