'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Book, Code, Flash, HamburgerMenu, CloseCircle, SearchNormal1 } from 'iconsax-reactjs';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const pathname = usePathname();

    const menuItems = [
        {
            title: 'Getting Started',
            items: [
                { name: 'Introduction', href: '/docs' },
                { name: 'Quickstart', href: '/docs/quickstart' },
                { name: 'Payment Links', href: '/docs/payment-links' },
                { name: 'Authentication', href: '/docs/authentication' },
            ]
        },
        {
            title: 'API Reference',
            items: [
                { name: 'Checkouts', href: '/docs/api/checkouts' },
                { name: 'Products', href: '/docs/api/products' },
                { name: 'Webhooks', href: '/docs/api/webhooks' },
            ]
        },
        {
            title: 'MNEE Protocol',
            items: [
                { name: 'What is MNEE?', href: '/docs/mnee' },
                { name: 'CLI Tool', href: '/docs/mnee/cli' },
            ]
        },
    ];

    return (
        <div className="min-h-screen bg-[var(--color-bg-base)] flex flex-col md:flex-row">
            {/* Mobile Header */}
            <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-black/5 sticky top-0 z-30">
                <Link href="/" className="font-black text-xl text-[var(--color-brand-navy)] flex items-center gap-2">
                    <Flash variant="Bold" className="text-[var(--color-brand-orange)]" />
                    COAL <span className="text-[var(--color-text-secondary)] font-medium text-sm">DOCS</span>
                </Link>
                <button onClick={() => setIsMobileMenuOpen(true)}>
                    <HamburgerMenu size={24} />
                </button>
            </div>

            {/* Desktop Sidebar (Static) */}
            <aside className="hidden md:flex flex-col w-72 bg-white border-r border-black/5 sticky top-0 h-screen overflow-hidden">
                {/* Logo Area */}
                <div className="p-6 border-b border-black/5">
                    <Link href="/" className="font-black text-5xl text-[var(--color-brand-navy)] flex items-center gap-2">
                        coal
                    </Link>
                </div>

                {/* Search */}
                <div className="p-4">
                    <div className="relative">
                        <SearchNormal1 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            placeholder="Search docs..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-orange)]/20 transition-all"
                        />
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto p-4 space-y-8">
                    {menuItems.map((section, idx) => (
                        <div key={idx}>
                            <h4 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3 px-3">
                                {section.title}
                            </h4>
                            <ul className="space-y-1">
                                {section.items.map((item) => {
                                    const isActive = pathname === item.href;
                                    return (
                                        <li key={item.href}>
                                            <Link
                                                href={item.href}
                                                className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                                                    ? 'bg-[var(--color-brand-orange)]/10 text-[var(--color-brand-orange)]'
                                                    : 'text-[var(--color-brand-navy)] hover:bg-gray-100'
                                                    }`}
                                            >
                                                {item.name}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-black/5">
                    <Link href="/console" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold text-[var(--color-brand-navy)] hover:bg-gray-100">
                        <Code size={18} />
                        Developer Console
                    </Link>
                </div>
            </aside>

            {/* Mobile Sidebar (Drawer) */}
            <motion.aside
                initial={false}
                animate={{ x: isMobileMenuOpen ? 0 : '-100%' }}
                className="fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-black/5 flex flex-col md:hidden shadow-2xl"
            >
                {/* Logo Area */}
                <div className="p-6 border-b border-black/5 flex items-center justify-between">
                    <Link href="/" className="font-black text-2xl text-[var(--color-brand-navy)] flex items-center gap-2">
                        <Flash variant="Bold" size={28} className="text-[var(--color-brand-orange)]" />
                        COAL
                    </Link>
                    <button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-400">
                        <CloseCircle size={24} />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4">
                    <div className="relative">
                        <SearchNormal1 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            placeholder="Search docs..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-orange)]/20 transition-all"
                        />
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto p-4 space-y-8">
                    {menuItems.map((section, idx) => (
                        <div key={idx}>
                            <h4 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3 px-3">
                                {section.title}
                            </h4>
                            <ul className="space-y-1">
                                {section.items.map((item) => {
                                    const isActive = pathname === item.href;
                                    return (
                                        <li key={item.href}>
                                            <Link
                                                href={item.href}
                                                onClick={() => setIsMobileMenuOpen(false)}
                                                className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive
                                                    ? 'bg-[var(--color-brand-orange)]/10 text-[var(--color-brand-orange)]'
                                                    : 'text-[var(--color-brand-navy)] hover:bg-gray-100'
                                                    }`}
                                            >
                                                {item.name}
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>

                <div className="p-4 border-t border-black/5">
                    <Link href="/console" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold text-[var(--color-brand-navy)] hover:bg-gray-100">
                        <Code size={18} />
                        Console
                    </Link>
                </div>
            </motion.aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0">
                <div className="max-w-4xl mx-auto px-4 py-12 md:px-12 md:py-16">
                    <article className="prose prose-lg prose-slate max-w-none 
                        prose-headings:font-black prose-headings:text-[var(--color-brand-navy)] prose-headings:tracking-tight
                        prose-a:text-[var(--color-brand-orange)] prose-a:no-underline hover:prose-a:underline
                        prose-strong:text-[var(--color-brand-navy)]
                        prose-pre:bg-[#1e1e1e] prose-pre:text-gray-100 prose-pre:rounded-2xl prose-pre:shadow-lg
                        [&_pre_code]:bg-transparent [&_pre_code]:text-inherit [&_pre_code]:p-0
                    ">
                        {children}
                    </article>
                </div>
            </main>
        </div>
    );
}
