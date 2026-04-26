'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS: { href: string; label: string; icon: string }[] = [
    { href: '/', label: 'Shop', icon: '🏪' },
    { href: '/profile', label: 'Me', icon: '👤' },
];

export function TabBar() {
    const pathname = usePathname();

    return (
        <nav
            className="fixed bottom-0 inset-x-0 z-40 safe-bottom border-t border-black/10 bg-white/95 backdrop-blur"
            aria-label="Primary"
        >
            <div className="grid grid-cols-2 max-w-md mx-auto">
                {TABS.map((t) => {
                    const active = pathname === t.href;
                    return (
                        <Link
                            key={t.href}
                            href={t.href}
                            className={`flex flex-col items-center justify-center py-2 text-[11px] font-bold ${
                                active ? 'text-[var(--color-brand-navy)]' : 'text-gray-400'
                            }`}
                        >
                            <span className="text-xl leading-none mb-0.5">{t.icon}</span>
                            {t.label}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
