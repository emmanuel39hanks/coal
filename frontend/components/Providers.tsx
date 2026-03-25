'use client';

import * as React from 'react';
import { ToastProvider } from './Toast';
import { PrivyProvider } from '@privy-io/react-auth';
import type { PrivyClientConfig } from '@privy-io/react-auth';
import { base, baseSepolia } from 'viem/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const defaultChain = process.env.NEXT_PUBLIC_CHAIN_ENV === 'testnet' ? baseSepolia : base;

// Stable config object — must be module-level to avoid recreating on every render,
// which would cause Privy's internal useMemo to recompute and potentially
// re-trigger connector initialization.
const privyConfig: PrivyClientConfig = {
  defaultChain,
  supportedChains: [base, baseSepolia],
  loginMethods: ['email', 'passkey', 'google', 'wallet'],
  embeddedWallets: {
    ethereum: { createOnLogin: 'all-users' },
  },
  appearance: {
    theme: 'light',
    accentColor: '#FF5C16',
    logo: 'https://usecoal.xyz/logo.png',
    showWalletLoginFirst: false,
    walletList: ['metamask', 'coinbase_wallet', 'rainbow', 'wallet_connect'],
  },
  legal: {
    termsAndConditionsUrl: 'https://usecoal.xyz/terms',
    privacyPolicyUrl: 'https://usecoal.xyz/privacy',
  },
};

export function Providers({ children }: { children: React.ReactNode }) {
  if (!PRIVY_APP_ID) {
    return (
      <ToastProvider>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <PrivyProvider
        appId={PRIVY_APP_ID}
        config={privyConfig}
      >
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </PrivyProvider>
    </ToastProvider>
  );
}
