'use client';

import { useState } from 'react';
import { MiniKit } from '@worldcoin/minikit-js';
import { useMiniKitStatus } from './Providers';

export function WalletAuth({ onAuth }: { onAuth: (address: string) => void }) {
    const { installed } = useMiniKitStatus();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleAuth() {
        setError(null);

        if (!installed) {
            setError('This page must be opened inside the World App.');
            return;
        }

        setLoading(true);
        try {
            const { nonce } = await fetch('/api/nonce', {
                headers: { 'ngrok-skip-browser-warning': 'true' },
            }).then((r) => r.json());

            const { finalPayload } = await MiniKit.commandsAsync.walletAuth({
                nonce,
                statement: 'Sign in to Coal — agent commerce on World Chain.',
                expirationTime: new Date(Date.now() + 60 * 60 * 1000),
                notBefore: new Date(Date.now() - 60 * 1000),
                requestId: `coal-${Date.now()}`,
            });

            if (finalPayload.status === 'error') {
                setError(`Auth failed: ${finalPayload.error_code ?? 'unknown'}`);
                return;
            }

            const verifyRes = await fetch('/api/siwe/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                body: JSON.stringify({ payload: finalPayload, nonce }),
            });
            const verifyJson = (await verifyRes.json()) as { ok: boolean; address?: string; error?: string };
            if (!verifyRes.ok || !verifyJson.ok || !verifyJson.address) {
                setError(verifyJson.error || 'Signature verification failed');
                return;
            }

            onAuth(verifyJson.address);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Unexpected error');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex flex-col items-stretch gap-2">
            <button
                onClick={handleAuth}
                disabled={loading}
                className="h-12 w-full rounded-full bg-[var(--color-brand-navy)] text-white font-bold text-sm disabled:opacity-50"
            >
                {loading ? 'Connecting…' : 'Connect World wallet'}
            </button>
            {error && <p className="text-xs text-red-500 text-center">{error}</p>}
            {!installed && (
                <p className="text-[10px] text-gray-500 text-center leading-snug">
                    Outside World App: this button will show an error. Open the Mini App
                    from inside World App via the Developer Portal preview.
                </p>
            )}
        </div>
    );
}
