'use client';

import { useState } from 'react';
import { MiniKit, VerificationLevel } from '@worldcoin/minikit-js';
import { useMiniKitStatus } from './Providers';

const ACTION = process.env.NEXT_PUBLIC_WORLD_ACTION || 'verify_coal_user';

export function WorldIdVerify({
    payerAddress,
    onVerified,
}: {
    payerAddress: string | null;
    onVerified: (nullifierHash: string, level: string) => void;
}) {
    const { installed } = useMiniKitStatus();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleVerify() {
        setError(null);
        if (!installed) {
            setError('World ID verify requires opening this in World App.');
            return;
        }
        setLoading(true);
        try {
            const { finalPayload } = await MiniKit.commandsAsync.verify({
                action: ACTION,
                signal: payerAddress ?? '',
                verification_level: VerificationLevel.Device,
            });

            if (finalPayload.status === 'error') {
                setError(`Verification cancelled: ${finalPayload.error_code ?? 'unknown'}`);
                return;
            }

            // The success payload comes in two shapes — single-action or multi.
            // We only send one action here, so narrow to the single-action shape.
            // Multi-action responses carry a `verifications` array; fall through
            // to the first entry if World App returns that shape anyway.
            const proof = 'nullifier_hash' in finalPayload
                ? { nullifierHash: finalPayload.nullifier_hash, level: String(finalPayload.verification_level) }
                : finalPayload.verifications?.[0]
                    ? {
                        nullifierHash: finalPayload.verifications[0].nullifier_hash,
                        level: String(finalPayload.verifications[0].verification_level),
                    }
                    : null;

            if (!proof) {
                setError('No nullifier in verification response');
                return;
            }

            // For the hackathon demo we pass the proof up to the parent.
            // Production use should POST to a backend route that verifies
            // the proof against the Worldcoin API (requires WORLD_API_KEY).
            onVerified(proof.nullifierHash, proof.level);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unexpected error');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <button
                onClick={handleVerify}
                disabled={loading}
                className="h-11 w-full rounded-full bg-black text-white font-bold text-sm disabled:opacity-50"
            >
                {loading ? 'Verifying…' : 'Verify with World ID'}
            </button>
            {error && <p className="text-xs text-red-500 text-center">{error}</p>}
        </div>
    );
}
