'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { getApiBaseUrl } from '@/lib/api-base';
import {
    Flash,
    Coin,
    Box,
    Notification,
    Setting2,
    Code,
    DocumentText,
    Shield,
    Moneys,
    SearchNormal1,
    HamburgerMenu,
    CloseCircle,
    CommandSquare,
    Global,
} from 'iconsax-reactjs';

// ─── Nav Data ───────────────────────────────────────────────────────────────

type NavItem = { name: string; href: string };
type NavSection = { title: string; icon: React.ReactNode; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
    {
        title: 'Getting Started',
        icon: <Flash size={14} variant="Bold" />,
        items: [
            { name: 'Introduction', href: '/docs' },
            { name: 'Quickstart', href: '/docs/quickstart' },
            { name: 'Authentication', href: '/docs/authentication' },
            { name: 'Environments', href: '/docs/environments' },
        ],
    },
    {
        title: 'Accept Payments',
        icon: <Coin size={14} variant="Bold" />,
        items: [
            { name: 'Payment Flow', href: '/docs/payment-flow' },
            { name: 'Payment Links', href: '/docs/payment-links' },
            { name: 'Checkout Sessions', href: '/docs/checkout-sessions' },
            { name: 'Embedded Widget', href: '/docs/widget-embed' },
        ],
    },
    {
        title: 'Products',
        icon: <Box size={14} variant="Bold" />,
        items: [
            { name: 'Creating Products', href: '/docs/products' },
            { name: 'Manage Catalog', href: '/docs/products/manage' },
        ],
    },
    {
        title: 'Webhooks',
        icon: <Notification size={14} variant="Bold" />,
        items: [
            { name: 'Overview', href: '/docs/webhooks' },
            { name: 'Signature Verification', href: '/docs/webhooks/signatures' },
            { name: 'Retry Logic', href: '/docs/webhooks/retries' },
        ],
    },
    {
        title: 'Agents',
        icon: <CommandSquare size={14} variant="Bold" />,
        items: [
            { name: 'Agent Discovery', href: '/docs/agent-discovery' },
            { name: 'Autonomous Payments', href: '/docs/agent-payments' },
            { name: 'Agent-Payable Gates', href: '/docs/paywalls' },
        ],
    },
    {
        title: 'Advanced',
        icon: <Setting2 size={14} variant="Bold" />,
        items: [
            { name: 'Revenue Splits', href: '/docs/splits' },
            { name: 'Multi-Token', href: '/docs/multi-token' },
            { name: 'Auth & Capture', href: '/docs/auth-capture' },
        ],
    },
    {
        title: 'Widget SDK',
        icon: <Code size={14} variant="Bold" />,
        items: [
            { name: 'JavaScript SDK', href: '/docs/sdk/javascript' },
            { name: 'React Component', href: '/docs/sdk/react' },
            { name: 'Events Reference', href: '/docs/sdk/events' },
        ],
    },
    {
        title: 'API Reference',
        icon: <DocumentText size={14} variant="Bold" />,
        items: [
            { name: 'Checkouts', href: '/docs/api/checkouts' },
            { name: 'Products', href: '/docs/api/products' },
            { name: 'Payment Links', href: '/docs/api/payment-links' },
            { name: 'Webhooks', href: '/docs/api/webhooks' },
            { name: 'Paywalls', href: '/docs/api/paywalls' },
            { name: 'Splits', href: '/docs/api/splits' },
        ],
    },
    {
        title: 'Security',
        icon: <Shield size={14} variant="Bold" />,
        items: [
            { name: 'Best Practices', href: '/docs/security' },
            { name: 'Rate Limits', href: '/docs/security/rate-limits' },
            { name: 'Sanctions', href: '/docs/security/sanctions' },
        ],
    },
    {
        title: 'Settlement',
        icon: <Moneys size={14} variant="Bold" />,
        items: [
            { name: 'Settlement Compatibility', href: '/docs/mnee' },
            { name: 'Verification Flow', href: '/docs/mnee/transactions' },
        ],
    },
];

// Flat ordered list for prev/next navigation
const ALL_PAGES: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

// ─── PrevNextNav ─────────────────────────────────────────────────────────────

function PrevNextNav({ pathname }: { pathname: string }) {
    const currentIndex = ALL_PAGES.findIndex((p) => p.href === pathname);
    const prev = currentIndex > 0 ? ALL_PAGES[currentIndex - 1] : null;
    const next = currentIndex >= 0 && currentIndex < ALL_PAGES.length - 1 ? ALL_PAGES[currentIndex + 1] : null;

    if (!prev && !next) return null;

    return (
        <nav className="mt-16 pt-8 border-t border-black/5 flex items-center justify-between gap-4">
            {prev ? (
                <Link
                    href={prev.href}
                    className="group flex flex-col items-start gap-1 px-5 py-4 rounded-xl border border-black/8 hover:border-[var(--color-brand-orange)]/30 hover:bg-orange-50/50 transition-all max-w-xs"
                >
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="rotate-180 group-hover:-translate-x-0.5 transition-transform">
                            <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Previous
                    </span>
                    <span className="text-sm font-bold text-[var(--color-brand-navy)] group-hover:text-[var(--color-brand-orange)] transition-colors">
                        {prev.name}
                    </span>
                </Link>
            ) : <div />}

            {next ? (
                <Link
                    href={next.href}
                    className="group flex flex-col items-end gap-1 px-5 py-4 rounded-xl border border-black/8 hover:border-[var(--color-brand-orange)]/30 hover:bg-orange-50/50 transition-all max-w-xs"
                >
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        Next
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="group-hover:translate-x-0.5 transition-transform">
                            <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </span>
                    <span className="text-sm font-bold text-[var(--color-brand-navy)] group-hover:text-[var(--color-brand-orange)] transition-colors">
                        {next.name}
                    </span>
                </Link>
            ) : <div />}
        </nav>
    );
}

// ─── Sidebar Nav Content ─────────────────────────────────────────────────────

function SidebarNav({
    pathname,
    searchQuery,
    onNavigate,
}: {
    pathname: string;
    searchQuery: string;
    onNavigate?: () => void;
}) {
    const filteredSections = useMemo(() => {
        if (!searchQuery.trim()) return NAV_SECTIONS;
        const q = searchQuery.toLowerCase();
        return NAV_SECTIONS.map((section) => ({
            ...section,
            items: section.items.filter((item) =>
                item.name.toLowerCase().includes(q) ||
                section.title.toLowerCase().includes(q)
            ),
        })).filter((s) => s.items.length > 0);
    }, [searchQuery]);

    return (
        <nav className="flex-1 overflow-y-auto px-3 pb-6">
            {filteredSections.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-gray-400">No results for "{searchQuery}"</p>
            )}
            {filteredSections.map((section) => (
                <div key={section.title} className="mb-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 px-3 py-2 mt-4">
                        <span className="text-gray-300">{section.icon}</span>
                        {section.title}
                    </div>
                    <ul className="space-y-0.5">
                        {section.items.map((item) => {
                            const isActive = pathname === item.href;
                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        onClick={onNavigate}
                                        className={`block px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${isActive
                                            ? 'bg-[var(--color-brand-orange)]/10 text-[var(--color-brand-orange)] font-bold'
                                            : 'text-[var(--color-brand-navy)]/70 hover:text-[var(--color-brand-navy)] hover:bg-gray-50'
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
    );
}

// ─── Sidebar Shell ────────────────────────────────────────────────────────────

function SidebarShell({
    pathname,
    onNavigate,
    showClose,
    onClose,
}: {
    pathname: string;
    onNavigate?: () => void;
    showClose?: boolean;
    onClose?: () => void;
}) {
    const [searchQuery, setSearchQuery] = useState('');
    const apiPlaygroundUrl = `${getApiBaseUrl()}/api/docs/ui`;
    const apiPlaygroundEnvLabel = apiPlaygroundUrl.includes('localhost') || apiPlaygroundUrl.includes('127.0.0.1') ? 'Local' : 'Live';

    return (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="px-6 py-5 border-b border-black/5 flex items-center justify-between shrink-0">
                <Link href="/" className="font-black text-4xl text-[var(--color-brand-navy)] tracking-tighter leading-none" onClick={onNavigate}>
                    coal
                </Link>
                {showClose && (
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                        aria-label="Close menu"
                    >
                        <CloseCircle size={22} />
                    </button>
                )}
            </div>

            {/* Search */}
            <div className="px-4 py-3 shrink-0">
                <div className="relative">
                    <SearchNormal1
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                        size={15}
                    />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search docs..."
                        className="w-full pl-9 pr-4 py-2 rounded-lg bg-gray-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-orange)]/25 focus:bg-white transition-all placeholder:text-gray-400"
                    />
                </div>
            </div>

            {/* Nav */}
            <SidebarNav pathname={pathname} searchQuery={searchQuery} onNavigate={onNavigate} />

            {/* Footer links */}
            <div className="px-4 py-4 border-t border-black/5 shrink-0 space-y-1">
                <Link
                    href="/console"
                    onClick={onNavigate}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-semibold text-[var(--color-brand-navy)]/70 hover:text-[var(--color-brand-navy)] hover:bg-gray-50 transition-all"
                >
                    <CommandSquare size={15} />
                    Developer Console
                </Link>
                <a
                    href={apiPlaygroundUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-semibold text-[var(--color-brand-navy)]/70 hover:text-[var(--color-brand-navy)] hover:bg-gray-50 transition-all"
                >
                    <Global size={15} />
                    API Playground
                    <span className="ml-auto text-[10px] font-bold text-gray-300 uppercase tracking-wider">{apiPlaygroundEnvLabel}</span>
                </a>
            </div>
        </div>
    );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function DocsLayout({ children }: { children: React.ReactNode }) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const pathname = usePathname();

    return (
        <div className="min-h-screen bg-white flex">
            {/* ── Desktop Sidebar ── */}
            <aside className="hidden md:flex flex-col w-72 bg-white border-r border-black/5 sticky top-0 h-screen overflow-hidden shrink-0">
                <SidebarShell pathname={pathname} />
            </aside>

            {/* ── Mobile Header ── */}
            <div className="md:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between px-4 py-3.5 bg-white/90 backdrop-blur-sm border-b border-black/5">
                <Link href="/" className="font-black text-2xl text-[var(--color-brand-navy)] tracking-tighter leading-none">
                    coal
                </Link>
                <button
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    aria-label="Open menu"
                >
                    <HamburgerMenu size={22} className="text-[var(--color-brand-navy)]" />
                </button>
            </div>

            {/* ── Mobile Drawer ── */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            key="backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
                            onClick={() => setIsMobileMenuOpen(false)}
                        />
                        {/* Drawer */}
                        <motion.aside
                            key="drawer"
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                            className="fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-black/5 flex flex-col md:hidden shadow-2xl"
                        >
                            <SidebarShell
                                pathname={pathname}
                                onNavigate={() => setIsMobileMenuOpen(false)}
                                showClose
                                onClose={() => setIsMobileMenuOpen(false)}
                            />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* ── Main ── */}
            <main className="flex-1 min-w-0 pt-14 md:pt-0">
                <div className="max-w-3xl mx-auto px-6 py-12 md:px-12 md:py-16">
                    <article className="prose prose-slate max-w-none
                        prose-headings:font-black prose-headings:text-[var(--color-brand-navy)] prose-headings:tracking-tight
                        prose-h1:text-4xl prose-h2:text-2xl prose-h2:border-b prose-h2:border-black/5 prose-h2:pb-3
                        prose-a:text-[var(--color-brand-orange)] prose-a:no-underline hover:prose-a:underline prose-a:font-semibold
                        prose-strong:text-[var(--color-brand-navy)]
                        prose-code:bg-orange-50 prose-code:text-[var(--color-brand-orange)] prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
                        prose-pre:bg-[#0d1117] prose-pre:text-gray-100 prose-pre:rounded-2xl prose-pre:shadow-lg prose-pre:border prose-pre:border-white/10
                        [&_pre_code]:bg-transparent [&_pre_code]:text-inherit [&_pre_code]:p-0 [&_pre_code]:text-sm
                        prose-blockquote:border prose-blockquote:border-orange-200 prose-blockquote:bg-orange-50/50 prose-blockquote:rounded-2xl prose-blockquote:px-5 prose-blockquote:py-4 prose-blockquote:not-italic prose-blockquote:shadow-sm prose-blockquote:before:content-none prose-blockquote:after:content-none
                        prose-table:text-sm prose-th:font-bold prose-th:bg-gray-50
                    ">
                        {children}
                    </article>

                    <PrevNextNav pathname={pathname} />
                </div>
            </main>
        </div>
    );
}
