'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Add, People, Trash, Warning2, CloseCircle } from 'iconsax-reactjs';
import useSWR, { mutate } from 'swr';
import { useApi } from '@/lib/api';
import { Skeleton } from '@/components/Skeleton';

const ROLE_COLORS: Record<string, string> = {
    owner:  'bg-purple-50 text-purple-700 border-purple-100',
    admin:  'bg-blue-50 text-blue-700 border-blue-100',
    member: 'bg-green-50 text-green-700 border-green-100',
    viewer: 'bg-gray-100 text-gray-600 border-gray-200',
};

export default function TeamPage() {
    const { fetcher, request } = useApi();
    const { data, isLoading } = useSWR('/api/console/team', fetcher);
    const members = data?.members ?? [];

    const [isInviteOpen, setIsInviteOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'admin' | 'member' | 'viewer'>('member');
    const [inviting, setInviting] = useState(false);
    const [inviteError, setInviteError] = useState('');
    const [inviteSuccess, setInviteSuccess] = useState('');

    const [removeModal, setRemoveModal] = useState<{ isOpen: boolean; id: string; name: string }>({
        isOpen: false, id: '', name: '',
    });
    const [removing, setRemoving] = useState(false);

    const handleInvite = async () => {
        setInviteError('');
        setInviteSuccess('');
        setInviting(true);
        try {
            const res = await request('/api/console/team', {
                method: 'POST',
                body: JSON.stringify({ email, role }),
            });
            mutate('/api/console/team');
            if (res?.pending) {
                setInviteSuccess(`Invite sent to ${res.email}. They'll be added when they accept.`);
                setEmail('');
                setRole('member');
            } else {
                setIsInviteOpen(false);
                setEmail('');
                setRole('member');
            }
        } catch (e: any) {
            setInviteError(e?.message ?? 'Failed to add member');
        } finally {
            setInviting(false);
        }
    };

    const handleRemove = async () => {
        setRemoving(true);
        try {
            await request(`/api/console/team/${removeModal.id}`, { method: 'DELETE' });
            mutate('/api/console/team');
            setRemoveModal({ isOpen: false, id: '', name: '' });
        } catch {
            // silently close
            setRemoveModal({ isOpen: false, id: '', name: '' });
        } finally {
            setRemoving(false);
        }
    };

    return (
        <div className="space-y-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
                <div>
                    <h1 className="text-3xl font-black text-[var(--color-brand-navy)] tracking-tight">Team</h1>
                    <p className="text-[var(--color-text-secondary)] font-medium">Manage who has access to your account.</p>
                </div>
                <button
                    onClick={() => setIsInviteOpen(true)}
                    className="bg-black text-white px-5 py-2.5 rounded-full flex items-center gap-2 text-sm font-bold shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px]"
                >
                    <Add size={18} />
                    Add Member
                </button>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-[40px] border-2 border-black/5 p-8"
            >
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left border-b border-black/5">
                                <th className="pb-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider pl-4">Member</th>
                                <th className="pb-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Role</th>
                                <th className="pb-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Joined</th>
                                <th className="pb-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider pr-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm font-medium text-[var(--color-brand-navy)]">
                            {isLoading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <tr key={i} className="group">
                                        <td className="py-4 pl-4 rounded-l-xl">
                                            <div className="space-y-1.5">
                                                <Skeleton className="h-4 w-28 rounded-full" />
                                                <Skeleton className="h-3 w-40 rounded-full" />
                                            </div>
                                        </td>
                                        <td className="py-4"><Skeleton className="h-6 w-16 rounded-lg" /></td>
                                        <td className="py-4"><Skeleton className="h-3.5 w-20 rounded-full" /></td>
                                        <td className="py-4 pr-4 rounded-r-xl text-right">
                                            <Skeleton className="h-6 w-16 rounded-full ml-auto" />
                                        </td>
                                    </tr>
                                ))
                            ) : members.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-12">
                                        <div className="flex flex-col items-center gap-3 text-gray-400">
                                            <People size={32} variant="Bold" />
                                            <p className="font-medium">No team members yet</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                members.map((m: any) => (
                                    <tr key={m.id} className="group hover:bg-[var(--color-bg-base)] transition-colors">
                                        <td className="py-4 pl-4 rounded-l-xl">
                                            <div>
                                                <div className="font-bold">{m.user.name || '—'}</div>
                                                <div className="text-xs text-[var(--color-text-secondary)]">{m.user.email}</div>
                                            </div>
                                        </td>
                                        <td className="py-4">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${ROLE_COLORS[m.role] ?? ROLE_COLORS.viewer}`}>
                                                {m.role}
                                            </span>
                                        </td>
                                        <td className="py-4 text-[var(--color-text-secondary)]">
                                            {new Date(m.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="py-4 pr-4 rounded-r-xl text-right">
                                            {m.role !== 'owner' && (
                                                <button
                                                    onClick={() => setRemoveModal({ isOpen: true, id: m.id, name: m.user.name || m.user.email })}
                                                    className="inline-flex items-center gap-1.5 text-red-500 font-bold text-xs hover:text-red-700 hover:underline transition-colors"
                                                >
                                                    <Trash size={14} variant="Bold" />
                                                    Remove
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>

            {/* Invite Modal */}
            <AnimatePresence>
                {isInviteOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                            onClick={() => setIsInviteOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white w-full max-w-md rounded-[40px] p-8 relative z-10 shadow-2xl"
                        >
                            <button
                                onClick={() => setIsInviteOpen(false)}
                                className="absolute top-6 right-6 text-gray-400 hover:text-black"
                            >
                                <CloseCircle size={24} variant="Bold" />
                            </button>
                            <h2 className="text-2xl font-black text-[var(--color-brand-navy)] mb-6">Add Team Member</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-[var(--color-brand-navy)] mb-2 pl-4">Email</label>
                                    <input
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="w-full h-12 px-6 rounded-full bg-gray-100 border-2 border-transparent focus:border-[var(--color-brand-orange)] outline-none font-medium"
                                        placeholder="teammate@example.com"
                                        type="email"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-[var(--color-brand-navy)] mb-2 pl-4">Role</label>
                                    <select
                                        value={role}
                                        onChange={e => setRole(e.target.value as any)}
                                        className="w-full h-12 px-6 rounded-full bg-gray-100 border-2 border-transparent focus:border-[var(--color-brand-orange)] outline-none font-medium appearance-none"
                                    >
                                        <option value="admin">Admin — full access</option>
                                        <option value="member">Member — manage products & links</option>
                                        <option value="viewer">Viewer — read only</option>
                                    </select>
                                </div>
                                {inviteError && (
                                    <p className="text-sm text-red-500 font-medium pl-4">{inviteError}</p>
                                )}
                                {inviteSuccess && (
                                    <p className="text-sm text-green-600 font-medium pl-4">{inviteSuccess}</p>
                                )}
                                <button
                                    onClick={handleInvite}
                                    disabled={inviting || !email}
                                    className="w-full h-14 bg-black text-white rounded-full font-bold text-lg flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px] disabled:opacity-50 mt-2"
                                >
                                    {inviting ? 'Adding...' : 'Add Member'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Remove Confirmation Modal */}
            <AnimatePresence>
                {removeModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
                            onClick={() => setRemoveModal({ isOpen: false, id: '', name: '' })}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white w-full max-w-md rounded-[40px] p-8 relative z-10 shadow-2xl"
                        >
                            <div className="flex flex-col items-center text-center">
                                <div className="w-20 h-20 bg-red-50 border-2 border-red-200 rounded-full flex items-center justify-center mb-6 text-red-500">
                                    <Warning2 size={40} variant="Bold" />
                                </div>
                                <h2 className="text-2xl font-black text-[var(--color-brand-navy)]">Remove Member?</h2>
                                <p className="text-sm text-[var(--color-text-secondary)] mt-2 mb-6">
                                    Remove <strong>{removeModal.name}</strong> from your team?
                                    They will lose access immediately.
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setRemoveModal({ isOpen: false, id: '', name: '' })}
                                    className="flex-1 h-12 bg-gray-100 text-[var(--color-brand-navy)] rounded-full font-bold hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRemove}
                                    disabled={removing}
                                    className="flex-1 h-12 bg-red-500 text-white rounded-full font-bold hover:bg-red-600 transition-colors disabled:opacity-50"
                                >
                                    {removing ? 'Removing...' : 'Remove'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
