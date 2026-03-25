'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, TickCircle, EmptyWallet, AddCircle, Trash, Link21, Lock, Eye, EyeSlash, Refresh } from 'iconsax-reactjs';
import useSWR, { mutate } from 'swr';
import { useApi, apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { getErrorMessage } from '@/lib/api-errors';

type TeamMemberUser = { id: string; name: string | null; email: string };
type TeamMember = { id: string; role: string; createdAt: string; user: TeamMemberUser };

const ROLE_COLORS: Record<string, string> = {
    owner: 'bg-[var(--color-brand-navy)] text-white',
    admin: 'bg-[var(--color-brand-orange)] text-white',
    member: 'bg-blue-100 text-blue-700',
    viewer: 'bg-gray-100 text-gray-500',
};

export default function SettingsPage() {
    const { fetcher, request } = useApi();
    const { getAccessToken } = useAuth();
    const toast = useToast();
    const { data: user, isLoading } = useSWR('/api/console/settings', fetcher);
    const { data: teamData, isLoading: teamLoading } = useSWR('/api/console/team', fetcher);

    const [name, setName] = useState('');
    const [payoutAddress, setPayoutAddress] = useState('');
    const [webhookUrl, setWebhookUrl] = useState('');
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    // Webhook secret
    const [webhookSecretMasked, setWebhookSecretMasked] = useState('');
    const [revealedSecret, setRevealedSecret] = useState('');
    const [showSecret, setShowSecret] = useState(false);
    const [regenLoading, setRegenLoading] = useState(false);

    // Team invite form
    const [showInviteForm, setShowInviteForm] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
    const [inviting, setInviting] = useState(false);
    const [inviteError, setInviteError] = useState('');

    useEffect(() => {
        if (user) {
            setName(user.name || '');
            setPayoutAddress(user.payoutAddress || '');
            setWebhookUrl(user.webhookUrl || '');
            setWebhookSecretMasked(user.webhookSecretMasked || '');
        }
    }, [user]);

    const handleSave = async () => {
        setSaving(true);
        setSuccess(false);
        try {
            await request('/api/console/settings', {
                method: 'PUT',
                body: JSON.stringify({ name, payoutAddress, webhookUrl: webhookUrl || null })
            });
            mutate('/api/console/settings');
            setSuccess(true);
            toast('success', 'Settings saved');
            setTimeout(() => setSuccess(false), 3000);
        } catch (e) {
            toast('error', getErrorMessage(e, 'Failed to save settings'));
        } finally {
            setSaving(false);
        }
    };

    const handleRegenSecret = async () => {
        if (regenLoading) return;
        setRegenLoading(true);
        try {
            const res = await apiFetch('/api/console/settings/webhook-secret', { method: 'POST' }, getAccessToken);
            if (res.ok) {
                const data = await res.json();
                setRevealedSecret(data.webhookSecret);
                setShowSecret(true);
                setWebhookSecretMasked(`${data.webhookSecret.slice(0, 10)}...${data.webhookSecret.slice(-4)}`);
                toast('success', 'New secret generated — save it now');
            } else {
                toast('error', 'Failed to regenerate secret');
            }
        } finally {
            setRegenLoading(false);
        }
    };

    const handleInvite = async () => {
        if (!inviteEmail.trim()) return;
        setInviting(true);
        setInviteError('');
        try {
            const res = await request('/api/console/team', {
                method: 'POST',
                body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
            });
            mutate('/api/console/team');
            const msg = res?.pending ? `Invite sent to ${res.email}` : 'Team member added';
            toast('success', msg);
            setInviteEmail('');
            setInviteRole('member');
            setShowInviteForm(false);
        } catch (e: any) {
            const message = getErrorMessage(e, 'Failed to invite member');
            setInviteError(message);
            toast('error', message);
        } finally {
            setInviting(false);
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        try {
            await request(`/api/console/team/${memberId}`, { method: 'DELETE' });
            mutate('/api/console/team');
            toast('success', 'Team member removed');
        } catch (e) {
            toast('error', getErrorMessage(e, 'Failed to remove team member'));
        }
    };

    if (isLoading) return (
        <div className="space-y-8 max-w-2xl mx-auto">
            <div className="space-y-2">
                <Skeleton className="h-9 w-28 rounded-xl" />
                <Skeleton className="h-4 w-52 rounded-full" />
            </div>
            <div className="bg-white rounded-[40px] border-2 border-black/5 p-8 space-y-6">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-32 rounded-full ml-4" />
                        <Skeleton className="h-14 w-full rounded-full" />
                    </div>
                ))}
                <Skeleton className="h-14 w-full rounded-full" />
            </div>
        </div>
    );

    const displaySecret = showSecret && revealedSecret ? revealedSecret : webhookSecretMasked;

    return (
        <div className="space-y-8 max-w-2xl mx-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center md:text-left"
            >
                <h1 className="text-3xl font-black text-[var(--color-brand-navy)] tracking-tight">Settings</h1>
                <p className="text-[var(--color-text-secondary)] font-medium">Manage your profile, payouts, and webhooks.</p>
            </motion.div>

            {/* Profile & Payout */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-[40px] border-2 border-black/5 p-8 shadow-sm"
            >
                <div className="space-y-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2 pl-4">
                            <User size={18} variant="Bold" className="text-[var(--color-brand-orange)]" />
                            <label className="text-sm font-bold text-[var(--color-brand-navy)]">Display Name</label>
                        </div>
                        <input
                            value={name} onChange={e => setName(e.target.value)}
                            className="w-full h-14 px-6 rounded-full bg-gray-100 border-2 border-transparent focus:border-[var(--color-brand-orange)] outline-none font-medium text-[var(--color-brand-navy)]"
                            placeholder="Store Name"
                        />
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-2 pl-4">
                            <EmptyWallet size={18} variant="Bold" className="text-[var(--color-brand-orange)]" />
                            <label className="text-sm font-bold text-[var(--color-brand-navy)]">Settlement Payout Address</label>
                        </div>
                        <input
                            value={payoutAddress} onChange={e => setPayoutAddress(e.target.value)}
                            className="w-full h-14 px-6 rounded-full bg-gray-100 border-2 border-transparent focus:border-[var(--color-brand-orange)] outline-none font-mono text-sm text-[var(--color-brand-navy)]"
                            placeholder="0x..."
                        />
                        <p className="text-xs text-[var(--color-text-secondary)] pl-4 mt-2 mb-4">
                            Funds from sales will be settled to this address on Mainnet.
                        </p>
                        <div className="pl-4 text-xs font-medium text-gray-400 flex flex-wrap gap-x-4 gap-y-2">
                            <span>Supported wallets:</span>
                            <a href="https://metamask.io" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-brand-orange)] transition-colors underline decoration-dotted">MetaMask</a>
                            <a href="https://wallet.coinbase.com" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-brand-orange)] transition-colors underline decoration-dotted">Coinbase Wallet</a>
                            <a href="https://rainbow.me" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-brand-orange)] transition-colors underline decoration-dotted">Rainbow</a>
                        </div>
                    </div>

                    <div className="pt-4">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className={`w-full h-14 rounded-full font-bold text-lg flex items-center justify-center gap-2 transition-all border-2 border-black ${success
                                ? 'bg-white text-[#27AE60] shadow-[4px_4px_0px_0px_#27AE60] translate-x-[2px] translate-y-[2px]'
                                : 'bg-black text-white shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none'
                                }`}
                        >
                            {saving ? 'Saving...' : success ? (
                                <><TickCircle size={20} variant="Bold" />Saved!</>
                            ) : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Webhooks */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-white rounded-[40px] border-2 border-black/5 p-8 shadow-sm"
            >
                <div className="mb-6">
                    <h2 className="text-xl font-black text-[var(--color-brand-navy)]">Webhooks</h2>
                    <p className="text-sm text-[var(--color-text-secondary)] font-medium">
                        Receive real-time payment notifications on your server.
                    </p>
                </div>

                <div className="space-y-6">
                    {/* Webhook URL */}
                    <div>
                        <div className="flex items-center gap-2 mb-2 pl-4">
                            <Link21 size={18} variant="Bold" className="text-[var(--color-brand-orange)]" />
                            <label className="text-sm font-bold text-[var(--color-brand-navy)]">Webhook URL</label>
                        </div>
                        <input
                            value={webhookUrl}
                            onChange={e => setWebhookUrl(e.target.value)}
                            className="w-full h-14 px-6 rounded-full bg-gray-100 border-2 border-transparent focus:border-[var(--color-brand-orange)] outline-none font-medium text-[var(--color-brand-navy)] text-sm"
                            placeholder="https://yoursite.com/webhooks/coal"
                        />
                        <p className="text-xs text-[var(--color-text-secondary)] pl-4 mt-2">
                            Coal will POST a signed <code className="font-mono bg-gray-100 px-1 rounded">checkout.session.completed</code> event here when a payment is confirmed.
                        </p>
                    </div>

                    {/* Webhook Secret */}
                    <div>
                        <div className="flex items-center gap-2 mb-2 pl-4">
                            <Lock size={18} variant="Bold" className="text-[var(--color-brand-orange)]" />
                            <label className="text-sm font-bold text-[var(--color-brand-navy)]">Signing Secret</label>
                        </div>
                        <div className="flex gap-3">
                            <div className="flex-1 relative">
                                <input
                                    readOnly
                                    value={showSecret && revealedSecret ? displaySecret : (webhookSecretMasked || '—')}
                                    className="w-full h-14 px-6 pr-12 rounded-full bg-gray-100 border-2 border-transparent outline-none font-mono text-xs text-[var(--color-brand-navy)] select-all"
                                />
                                {revealedSecret && (
                                    <button
                                        onClick={() => setShowSecret(v => !v)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[var(--color-brand-navy)] transition-colors"
                                    >
                                        {showSecret ? <EyeSlash size={18} variant="Linear" /> : <Eye size={18} variant="Linear" />}
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={handleRegenSecret}
                                disabled={regenLoading}
                                title="Regenerate secret"
                                className="h-14 px-5 rounded-full bg-gray-100 border-2 border-transparent hover:border-[var(--color-brand-orange)] text-[var(--color-brand-navy)] flex items-center gap-2 font-bold text-sm transition-all disabled:opacity-50"
                            >
                                <Refresh size={18} variant="Linear" className={regenLoading ? 'animate-spin' : ''} />
                                Regenerate
                            </button>
                        </div>
                        {showSecret && revealedSecret && (
                            <p className="text-xs font-bold text-amber-600 pl-4 mt-2">
                                Save this secret now — it won&apos;t be shown again after you leave this page.
                            </p>
                        )}
                        <p className="text-xs text-[var(--color-text-secondary)] pl-4 mt-2">
                            Verify the <code className="font-mono bg-gray-100 px-1 rounded">Coal-Signature</code> header on incoming webhooks using this secret.
                        </p>
                    </div>

                    <div>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="h-12 px-8 rounded-full font-bold bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none transition-all text-sm"
                        >
                            {saving ? 'Saving...' : 'Save Webhook URL'}
                        </button>
                    </div>
                </div>
            </motion.div>

            {/* Team Management */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-[40px] border-2 border-black/5 p-8 shadow-sm"
            >
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-black text-[var(--color-brand-navy)]">Team</h2>
                        <p className="text-sm text-[var(--color-text-secondary)] font-medium">
                            Invite teammates to help manage this workspace.
                        </p>
                    </div>
                    <button
                        onClick={() => { setShowInviteForm(v => !v); setInviteError(''); }}
                        className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-full text-sm font-bold shadow-[3px_3px_0px_0px_#FF5C16] hover:shadow-[1px_1px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none active:translate-x-[3px] active:translate-y-[3px]"
                    >
                        <AddCircle size={16} variant="Bold" />
                        Invite Member
                    </button>
                </div>

                {showInviteForm && (
                    <div className="mb-6 p-6 bg-gray-50 rounded-3xl space-y-4">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                value={inviteEmail}
                                onChange={e => setInviteEmail(e.target.value)}
                                className="flex-1 h-12 px-5 rounded-full bg-white border-2 border-black/10 focus:border-[var(--color-brand-orange)] outline-none font-medium text-[var(--color-brand-navy)]"
                                placeholder="colleague@example.com"
                                type="email"
                            />
                            <select
                                value={inviteRole}
                                onChange={e => setInviteRole(e.target.value as 'admin' | 'member' | 'viewer')}
                                className="h-12 px-5 rounded-full bg-white border-2 border-black/10 focus:border-[var(--color-brand-orange)] outline-none font-bold text-[var(--color-brand-navy)] cursor-pointer"
                            >
                                <option value="admin">Admin</option>
                                <option value="member">Member</option>
                                <option value="viewer">Viewer</option>
                            </select>
                            <button
                                onClick={handleInvite}
                                disabled={inviting || !inviteEmail.trim()}
                                className="h-12 px-6 bg-black text-white rounded-full font-bold text-sm shadow-[3px_3px_0px_0px_#FF5C16] hover:shadow-[1px_1px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none disabled:opacity-50 disabled:pointer-events-none"
                            >
                                {inviting ? 'Inviting...' : 'Send Invite'}
                            </button>
                        </div>
                        {inviteError && (
                            <p className="text-sm text-red-500 font-medium pl-2">{inviteError}</p>
                        )}
                    </div>
                )}

                {teamLoading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-3">
                                    <Skeleton className="w-10 h-10 rounded-full" />
                                    <div className="space-y-1.5">
                                        <Skeleton className="h-3.5 w-28 rounded-full" />
                                        <Skeleton className="h-3 w-40 rounded-full" />
                                    </div>
                                </div>
                                <Skeleton className="h-6 w-16 rounded-full" />
                            </div>
                        ))}
                    </div>
                ) : !teamData?.members?.length ? (
                    <div className="text-center py-6 text-gray-400 font-medium">No team members yet.</div>
                ) : (
                    <div className="space-y-3">
                        {teamData.members.map((member: TeamMember) => (
                            <div
                                key={member.id}
                                className="flex items-center justify-between p-4 rounded-2xl hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                        <User size={18} variant="Bold" className="text-[var(--color-brand-navy)]" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-[var(--color-brand-navy)] truncate">
                                            {member.user.name || member.user.email}
                                        </p>
                                        <p className="text-xs text-[var(--color-text-secondary)] truncate">
                                            {member.user.email}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0 ml-4">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold capitalize ${ROLE_COLORS[member.role] ?? 'bg-gray-100 text-gray-500'}`}>
                                        {member.role}
                                    </span>
                                    {member.role !== 'owner' && (
                                        <button
                                            onClick={() => handleRemoveMember(member.id)}
                                            className="text-gray-300 hover:text-red-500 transition-colors"
                                            title="Remove member"
                                        >
                                            <Trash size={16} variant="Bold" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </motion.div>
        </div>
    );
}
