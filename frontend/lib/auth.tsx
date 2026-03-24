'use client';

import { useToast } from '@/components/Toast';
import { usePrivy, useWallets } from '@privy-io/react-auth';

const isConfigured = Boolean(process.env.NEXT_PUBLIC_PRIVY_APP_ID);

export type PrivySafe = {
    ready: boolean;
    authenticated: boolean;
    user: any;
    login: () => void;
    logout: () => Promise<void>;
    getAccessToken: () => Promise<string | null>;
};

function useAuthConfigured(): PrivySafe {
    return usePrivy() as PrivySafe;
}

function useAuthFallback(): PrivySafe {
    const toast = useToast();

    return {
        ready: true,
        authenticated: false,
        user: null,
        login: () => {
            console.warn('[Coal] Set NEXT_PUBLIC_PRIVY_APP_ID to enable authentication.');
            toast('error', 'Auth not configured. Set NEXT_PUBLIC_PRIVY_APP_ID in your .env file.');
        },
        logout: async () => {},
        getAccessToken: async () => null,
    };
}

function useAuthWalletsConfigured(): { wallets: any[] } {
    return useWallets() as { wallets: any[] };
}

function useAuthWalletsFallback(): { wallets: any[] } {
    return { wallets: [] };
}

export const useAuth: () => PrivySafe = isConfigured ? useAuthConfigured : useAuthFallback;
export const useAuthWallets: () => { wallets: any[] } = isConfigured ? useAuthWalletsConfigured : useAuthWalletsFallback;
