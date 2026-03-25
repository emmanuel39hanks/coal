'use client';

import { useRef, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth as usePrivy } from '@/lib/auth';
import useSWR, { mutate } from 'swr';
import { useApi, apiFetch } from '@/lib/api';
import { useWorkspace, type Workspace } from '@/lib/workspace';
import {
    Home,
    Receipt1,
    Box,
    Key,
    Setting2,
    Moneys,
    TrendUp,
    People,
    Flash,
    Lock,
    Logout,
    ArrowUp2,
    Buildings2,
    TickCircle,
    Add,
} from 'iconsax-reactjs';

export default function ConsoleSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { logout, user, getAccessToken } = usePrivy();
    const { fetcher } = useApi();
    const { activeWorkspaceId, switchWorkspace, setWorkspaces, currentWorkspace } = useWorkspace();

    const [profileOpen, setProfileOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);
    const [newWsMode, setNewWsMode] = useState(false);
    const [newWsName, setNewWsName] = useState('');
    const [newWsLoading, setNewWsLoading] = useState(false);

    // Fetch available workspaces (own + team memberships)
    // Use a fetcher that bypasses workspace context so we always get the full list
    const { data: wsData } = useSWR<{ data: { workspaces: Workspace[] } }>(
        '/api/console/workspaces',
        fetcher
    );

    useEffect(() => {
        if (wsData?.data?.workspaces) {
            setWorkspaces(wsData.data.workspaces);
        }
    }, [wsData, setWorkspaces]);

    const workspaces: Workspace[] = wsData?.data?.workspaces ?? [];
    const hasMultipleWorkspaces = workspaces.length > 1;

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
                setProfileOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleCreateWorkspace = async () => {
        const name = newWsName.trim();
        if (!name || newWsLoading) return;
        setNewWsLoading(true);
        try {
            const res = await apiFetch('/api/console/workspaces', {
                method: 'POST',
                body: JSON.stringify({ name }),
            }, getAccessToken);
            if (res.ok) {
                const data = await res.json();
                await mutate('/api/console/workspaces');
                setNewWsMode(false);
                setNewWsName('');
                switchWorkspace(data.data?.id ?? null);
            }
        } finally {
            setNewWsLoading(false);
        }
    };

    const navItems = [
        { name: 'Overview', href: '/console', icon: Home },
        { name: 'Analytics', href: '/console/analytics', icon: TrendUp },
        { name: 'Transactions', href: '/console/transactions', icon: Receipt1 },
        { name: 'Products', href: '/console/products', icon: Box },
        { name: 'Subscriptions', href: '/console/subscriptions', icon: Moneys },
        { name: 'Payment Links', href: '/console/payment-links', icon: Moneys },
        { name: 'Paywalls', href: '/console/paywalls', icon: Lock },
        { name: '0G', href: '/console/0g', icon: Flash },
    ];

    const profileItems = [
        { name: 'Settings', href: '/console/settings', icon: Setting2 },
        { name: 'API Keys', href: '/console/keys', icon: Key },
        { name: 'Team', href: '/console/team', icon: People },
    ];

    // Resolve display info from Privy user
    const email: string | undefined =
        user?.email?.address ??
        user?.google?.email ??
        (user?.linkedAccounts as any[])?.find((a: any) => a.type === 'google_oauth')?.email;
    const displayName = email ? email.split('@')[0] : 'Account';
    const displayEmail = email || '';
    const initial = displayName.charAt(0).toUpperCase();

    // Workspace display
    const wsName = currentWorkspace?.name ?? displayName;
    const wsInitial = wsName.charAt(0).toUpperCase();
    const isGuest = currentWorkspace && !currentWorkspace.isOwn && !currentWorkspace.isDefault;

    return (
        <aside className="w-64 bg-white border-r-2 border-black/5 h-screen flex flex-col fixed left-0 top-0 z-40 hidden md:flex">
            <div className="p-8">
                <Link href="/" className="inline-block hover:scale-105 transition-transform">
                    <span className="text-4xl font-black tracking-tighter text-[var(--color-brand-navy)]">coal</span>
                </Link>
            </div>

            {/* Current workspace indicator (shown when in a guest workspace) */}
            {isGuest && (
                <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-[var(--color-brand-orange)]/10 border border-[var(--color-brand-orange)]/20">
                    <p className="text-[10px] font-black text-[var(--color-brand-orange)] uppercase tracking-wider mb-0.5">Viewing workspace</p>
                    <p className="text-xs font-bold text-[var(--color-brand-navy)] truncate">{currentWorkspace.name}</p>
                </div>
            )}

            <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 font-bold ${isActive
                                ? 'bg-black text-white shadow-[4px_4px_0px_0px_#FF5C16]'
                                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-base)] hover:text-[var(--color-brand-navy)]'
                                }`}
                        >
                            <item.icon size={24} variant={isActive ? 'Bold' : 'Linear'} />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            {/* Profile section */}
            <div className="p-4 mt-auto relative" ref={profileRef}>
                {/* Upward popover */}
                {profileOpen && (
                    <div className="absolute bottom-full mb-2 left-4 right-4 bg-white rounded-2xl border-2 border-black/5 shadow-2xl overflow-hidden z-50">
                        {/* User info header */}
                        <div className="px-4 py-3 border-b border-black/5">
                            <p className="text-sm font-black text-[var(--color-brand-navy)] truncate">{displayName}</p>
                            {displayEmail && (
                                <p className="text-[11px] font-medium text-[var(--color-text-secondary)] truncate">{displayEmail}</p>
                            )}
                        </div>

                        {/* Workspace switcher — always visible */}
                        <div className="p-1.5 border-b border-black/5">
                            <p className="px-3 pt-1.5 pb-1 text-[10px] font-black text-[var(--color-text-secondary)] uppercase tracking-wider">
                                Workspaces
                            </p>
                            {workspaces.map((ws) => {
                                const isActive = activeWorkspaceId === ws.id || (!activeWorkspaceId && ws.isDefault);
                                return (
                                    <button
                                        key={ws.id}
                                        onClick={() => {
                                            setProfileOpen(false);
                                            setNewWsMode(false);
                                            // Switch to default workspace by clearing stored ID
                                            switchWorkspace(ws.isDefault ? null : ws.id);
                                        }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all hover:bg-[var(--color-bg-base)]"
                                    >
                                        <div className="w-7 h-7 rounded-lg bg-[var(--color-brand-navy)] flex items-center justify-center shrink-0">
                                            <span className="text-[11px] font-black text-white">{ws.name.charAt(0).toUpperCase()}</span>
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <p className="text-xs font-bold text-[var(--color-brand-navy)] truncate">{ws.name}</p>
                                            <p className="text-[10px] font-medium text-[var(--color-text-secondary)] capitalize">
                                                {ws.isOwn ? (ws.isDefault ? 'Default' : 'Owner') : ws.role}
                                            </p>
                                        </div>
                                        {isActive && (
                                            <TickCircle size={16} variant="Bold" className="text-[var(--color-brand-orange)] shrink-0" />
                                        )}
                                    </button>
                                );
                            })}

                            {/* New workspace inline input */}
                            {newWsMode ? (
                                <div className="flex items-center gap-1.5 px-2 py-1.5">
                                    <input
                                        autoFocus
                                        type="text"
                                        value={newWsName}
                                        onChange={e => setNewWsName(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleCreateWorkspace();
                                            if (e.key === 'Escape') { setNewWsMode(false); setNewWsName(''); }
                                        }}
                                        placeholder="Workspace name…"
                                        className="flex-1 text-xs font-medium bg-[var(--color-bg-base)] rounded-lg px-2.5 py-1.5 outline-none border border-black/10 focus:border-[var(--color-brand-orange)] text-[var(--color-brand-navy)] placeholder:text-[var(--color-text-secondary)]"
                                    />
                                    <button
                                        onClick={handleCreateWorkspace}
                                        disabled={!newWsName.trim() || newWsLoading}
                                        className="text-[10px] font-black text-[var(--color-brand-orange)] disabled:opacity-40 px-1"
                                    >
                                        {newWsLoading ? '…' : 'Create'}
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setNewWsMode(true)}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-base)] hover:text-[var(--color-brand-navy)] transition-all"
                                >
                                    <Add size={14} variant="Linear" />
                                    New Workspace
                                </button>
                            )}
                        </div>

                        {/* Profile links */}
                        <div className="p-1.5">
                            {profileItems.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setProfileOpen(false)}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                                            isActive
                                                ? 'bg-black/5 text-[var(--color-brand-navy)]'
                                                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-base)] hover:text-[var(--color-brand-navy)]'
                                        }`}
                                    >
                                        <item.icon size={18} variant={isActive ? 'Bold' : 'Linear'} />
                                        {item.name}
                                    </Link>
                                );
                            })}
                            <div className="mx-2 my-1.5 border-t border-black/5" />
                            <button
                                onClick={async () => {
                                    setProfileOpen(false);
                                    await logout();
                                    router.replace('/');
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 transition-all"
                            >
                                <Logout size={18} variant="Linear" />
                                Sign Out
                            </button>
                        </div>
                    </div>
                )}

                {/* Trigger */}
                <button
                    onClick={() => setProfileOpen((v) => !v)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-base)] hover:text-[var(--color-brand-navy)] transition-all"
                >
                    <div className="w-9 h-9 rounded-full bg-black/10 flex items-center justify-center shrink-0 relative">
                        <span className="text-sm font-black text-[var(--color-brand-navy)]">{isGuest ? wsInitial : initial}</span>
                        {hasMultipleWorkspaces && (
                            <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--color-brand-orange)] border-2 border-white flex items-center justify-center">
                                <Buildings2 size={7} variant="Bold" className="text-white" />
                            </div>
                        )}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-bold text-[var(--color-brand-navy)] truncate">
                            {isGuest ? currentWorkspace.name : displayName}
                        </p>
                        {isGuest ? (
                            <p className="text-[11px] font-medium text-[var(--color-brand-orange)] truncate capitalize">{currentWorkspace.role} access</p>
                        ) : displayEmail ? (
                            <p className="text-[11px] font-medium text-[var(--color-text-secondary)] truncate">{displayEmail}</p>
                        ) : null}
                    </div>
                    <ArrowUp2
                        size={16}
                        variant="Linear"
                        className={`shrink-0 transition-transform duration-200 ${profileOpen ? '' : 'rotate-180'}`}
                    />
                </button>
            </div>
        </aside>
    );
}
