'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { People, TickCircle, CloseCircle } from 'iconsax-reactjs';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { getErrorMessage } from '@/lib/api-errors';

const ROLE_COLORS: Record<string, string> = {
    admin: 'bg-blue-50 text-blue-700 border-blue-200',
    member: 'bg-green-50 text-green-700 border-green-200',
    viewer: 'bg-gray-100 text-gray-600 border-gray-200',
};

type InviteInfo = {
    merchantName: string;
    role: string;
    expiresAt: string;
};

export default function InvitePage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-[#F5F2ED] flex items-center justify-center"><div className="w-10 h-10 border-4 border-[#FF5C16] border-t-transparent rounded-full animate-spin" /></div>}>
            <InviteContent />
        </Suspense>
    );
}

function InviteContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');
    const { ready, authenticated, login, getAccessToken } = useAuth();

    const [invite, setInvite] = useState<InviteInfo | null>(null);
    const [loadError, setLoadError] = useState('');
    const [accepting, setAccepting] = useState(false);
    const [accepted, setAccepted] = useState(false);
    const [acceptError, setAcceptError] = useState('');

    // Load invite preview
    useEffect(() => {
        if (!token) {
            setLoadError('Invalid invite link — no token found.');
            return;
        }
        apiFetch(`/api/invite?token=${encodeURIComponent(token)}`)
            .then(async res => {
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    setLoadError(err?.error?.message || 'This invite link is invalid or has expired.');
                    return;
                }
                const data = await res.json();
                setInvite(data);
            })
            .catch(() => setLoadError('Failed to load invite details.'));
    }, [token]);

    // If just logged in with a token in URL, auto-accept
    useEffect(() => {
        if (ready && authenticated && invite && token && !accepted && !accepting) {
            handleAccept();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, authenticated, invite]);

    const handleAccept = async () => {
        if (!token) return;
        setAccepting(true);
        setAcceptError('');
        try {
            const res = await apiFetch('/api/console/team/accept', {
                method: 'POST',
                body: JSON.stringify({ token }),
            }, getAccessToken);

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                setAcceptError(err?.error?.message || 'Failed to accept invite.');
                return;
            }

            // alreadyMember: true means the invite was auto-accepted on signup — treat as success
            setAccepted(true);
            setTimeout(() => router.replace('/console'), 2000);
        } catch (e) {
            setAcceptError(getErrorMessage(e, 'Failed to accept invite.'));
        } finally {
            setAccepting(false);
        }
    };

    const handleLogin = () => {
        login();
    };

    if (!token || loadError) {
        return (
            <div className="min-h-screen bg-[#F5F2ED] flex items-center justify-center p-4">
                <div className="bg-white rounded-[40px] border-2 border-black/8 p-10 max-w-md w-full text-center shadow-lg">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CloseCircle size={32} variant="Bold" className="text-red-400" />
                    </div>
                    <h1 className="text-2xl font-black text-[#180D43]">Invalid Invite</h1>
                    <p className="text-[#5C5C5C] mt-2 mb-6 font-medium">
                        {loadError || 'This invite link is missing or malformed.'}
                    </p>
                    <a href="/" className="text-sm font-bold text-[#FF5C16] hover:underline">
                        Go to Coal →
                    </a>
                </div>
            </div>
        );
    }

    if (accepted) {
        return (
            <div className="min-h-screen bg-[#F5F2ED] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-[40px] border-2 border-black/8 p-10 max-w-md w-full text-center shadow-lg"
                >
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <TickCircle size={32} variant="Bold" className="text-green-500" />
                    </div>
                    <h1 className="text-2xl font-black text-[#180D43]">You're in!</h1>
                    <p className="text-[#5C5C5C] mt-2 font-medium">
                        Welcome to <strong>{invite?.merchantName}</strong>. Redirecting you to the console…
                    </p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F5F2ED] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[40px] border-2 border-black/8 p-10 max-w-md w-full shadow-lg"
            >
                {/* Logo */}
                <div className="flex items-center gap-1 mb-8">
                    <span className="text-2xl font-black text-[#180D43] tracking-tight">coal</span>
                    <span className="w-2 h-2 rounded-full bg-[#FF5C16]" />
                </div>

                {invite ? (
                    <>
                        <div className="w-14 h-14 bg-[#180D43] rounded-2xl flex items-center justify-center mb-6 text-2xl font-black text-[#FF5C16]">
                            {invite.merchantName.charAt(0).toUpperCase()}
                        </div>

                        <h1 className="text-2xl font-black text-[#180D43] leading-tight mb-2">
                            You've been invited to join <span className="text-[#FF5C16]">{invite.merchantName}</span>
                        </h1>

                        <div className="flex items-center gap-2 mb-6">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${ROLE_COLORS[invite.role] ?? ROLE_COLORS.member}`}>
                                {invite.role}
                            </span>
                            <span className="text-sm text-[#5C5C5C] font-medium">access level</span>
                        </div>

                        {acceptError && (
                            <p className="text-sm text-red-500 font-medium mb-4 bg-red-50 rounded-2xl px-4 py-3">
                                {acceptError}
                            </p>
                        )}

                        {ready && authenticated ? (
                            <button
                                onClick={handleAccept}
                                disabled={accepting}
                                className="w-full h-14 bg-black text-white rounded-full font-bold text-lg flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none disabled:opacity-50"
                            >
                                {accepting ? 'Accepting…' : (
                                    <>
                                        <People size={20} variant="Bold" />
                                        Accept Invitation
                                    </>
                                )}
                            </button>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-sm text-[#5C5C5C] font-medium mb-4">
                                    Sign in or create an account to accept this invite.
                                </p>
                                <button
                                    onClick={handleLogin}
                                    className="w-full h-14 bg-black text-white rounded-full font-bold text-lg flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none"
                                >
                                    Sign in to accept →
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="space-y-4 animate-pulse">
                        <div className="h-14 w-14 bg-gray-100 rounded-2xl" />
                        <div className="h-7 w-3/4 bg-gray-100 rounded-full" />
                        <div className="h-5 w-1/3 bg-gray-100 rounded-full" />
                        <div className="h-14 bg-gray-100 rounded-full mt-4" />
                    </div>
                )}
            </motion.div>
        </div>
    );
}
