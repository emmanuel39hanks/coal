'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { PrivyProvider } from '@privy-io/react-auth';
import { config } from '@/lib/wagmi';
import { useState, type ReactNode } from 'react';
import { base } from 'viem/chains';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  if (!PRIVY_APP_ID) {
    return (
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    );
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        defaultChain: base,
        supportedChains: [base],
        loginMethods: ['wallet', 'email', 'google'],
        embeddedWallets: {
          ethereum: { createOnLogin: 'users-without-wallets' },
        },
        appearance: {
          theme: 'light',
          accentColor: '#FF5C16',
          showWalletLoginFirst: true,
          walletList: ['metamask', 'coinbase_wallet', 'rainbow', 'wallet_connect'],
        },
      }}
    >
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  );
}
