'use client';

import * as React from 'react';
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";

const config = createConfig(
    getDefaultConfig({
        // Your dApps chains
        chains: [mainnet, sepolia],
        transports: {
            // RPC URL for each chain
            [mainnet.id]: http(), // Fallback to public RPCs
            [sepolia.id]: http(),
        },

        // Required API Keys
        walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "YOUR_PROJECT_ID",

        // Required App Info
        appName: "Coal Payment App",

        // Optional App Info
        appDescription: "Accept MNEE stablecoin. Split money automatically. Settle instantly.",
        appUrl: "https://usecoal.xyz", // your app's url
        appIcon: "https://usecoal.xyz/logo.png", // your app's icon
    }),
);

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <ConnectKitProvider>{children}</ConnectKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
