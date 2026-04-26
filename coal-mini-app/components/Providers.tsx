'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { MiniKit } from '@worldcoin/minikit-js';

interface MiniKitContextValue {
    installed: boolean;
    appId: string;
}

const MiniKitContext = createContext<MiniKitContextValue>({ installed: false, appId: '' });

export function useMiniKitStatus() {
    return useContext(MiniKitContext);
}

export function Providers({ children }: { children: React.ReactNode }) {
    const [installed, setInstalled] = useState(false);
    const appId = process.env.NEXT_PUBLIC_WORLD_APP_ID || '';

    useEffect(() => {
        // MiniKit.install() is a no-op outside the World App webview.
        // isInstalled() returns true only when running inside World App.
        try {
            if (!MiniKit.isInstalled()) {
                MiniKit.install(appId || undefined);
            }
            setInstalled(MiniKit.isInstalled());
        } catch (err) {
            // On SSR or in non-browser envs this can throw — ignore silently.
            console.warn('[coal-mini-app] MiniKit install failed:', err);
        }
    }, [appId]);

    return (
        <MiniKitContext.Provider value={{ installed, appId }}>
            {children}
        </MiniKitContext.Provider>
    );
}
