'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Home,
    Receipt1,
    Box,
    Key,
    Setting2,
    LogoutCurve
} from 'iconsax-reactjs';

export default function ConsoleSidebar() {
    const pathname = usePathname();

    const navItems = [
        { name: 'Overview', href: '/console', icon: Home },
        { name: 'Transactions', href: '/console/transactions', icon: Receipt1 },
        { name: 'Products', href: '/console/products', icon: Box },
        { name: 'API Keys', href: '/console/keys', icon: Key },
        { name: 'Settings', href: '/console/settings', icon: Setting2 },
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
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[var(--color-text-secondary)] hover:bg-red-50 hover:text-red-500 transition-all font-bold">
                    <LogoutCurve size={24} variant="Linear" />
                    Sign Out
                </button>
            </div>
        </aside>
    );
}
