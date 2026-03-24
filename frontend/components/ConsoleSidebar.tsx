'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth as usePrivy } from '@/lib/auth';
import {
    Home,
    Receipt1,
    Box,
    Key,
    Setting2,
    Moneys,
    TrendUp,
    User,
    People,
    Flash
} from 'iconsax-reactjs';

export default function ConsoleSidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { logout } = usePrivy();

    const navItems = [
        { name: 'Overview', href: '/console', icon: Home, activeColor: 'text-[var(--color-brand-orange)]' },
        { name: 'Analytics', href: '/console/analytics', icon: TrendUp, activeColor: 'text-[var(--color-brand-orange)]' },
        { name: 'Transactions', href: '/console/transactions', icon: Receipt1, activeColor: 'text-[var(--color-brand-blue)]' },
        { name: 'Products', href: '/console/products', icon: Box, activeColor: 'text-[var(--color-brand-lavender)]' },
        { name: 'Subscriptions', href: '/console/subscriptions', icon: Moneys, activeColor: 'text-[var(--color-brand-orange)]' },
        { name: 'Payment Links', href: '/console/payment-links', icon: Moneys, activeColor: 'text-green-500' },
        { name: 'API Keys', href: '/console/keys', icon: Key, activeColor: 'text-[#00AECC]' },
        { name: '0G', href: '/console/0g', icon: Flash, activeColor: 'text-[var(--color-brand-orange)]' },
        { name: 'Team', href: '/console/team', icon: People, activeColor: 'text-violet-500' },
        { name: 'Settings', href: '/console/settings', icon: Setting2, activeColor: 'text-[var(--color-brand-navy)]' },
    ];

    return (
        <aside className="w-64 bg-white border-r-2 border-black/5 h-screen flex flex-col fixed left-0 top-0 z-40 hidden md:flex">
            <div className="p-8">
                <Link href="/" className="inline-block hover:scale-105 transition-transform">
                    <span className="text-4xl font-black tracking-tighter text-[var(--color-brand-navy)]">coal</span>
                </Link>
            </div>

            <nav className="flex-1 px-4 space-y-2">
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
                            <item.icon size={24} variant={isActive ? "Bold" : "Linear"} />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 mt-auto">
                <button
                    onClick={async () => {
                        await logout();
                        router.replace('/');
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-base)] hover:text-[var(--color-brand-navy)] transition-all font-bold"
                >
                    <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center">
                        <User size={20} variant="Linear" className="text-[var(--color-brand-navy)]" />
                    </div>
                    Sign Out
                </button>
            </div>
        </aside>
    );
}
