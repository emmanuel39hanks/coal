"use client";
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowRight2, HamburgerMenu, CloseSquare } from 'iconsax-reactjs';
import { useAuth as usePrivy } from '@/lib/auth';

export default function Navbar() {
  const { authenticated } = usePrivy();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleScroll = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    e.preventDefault();
    setMobileOpen(false);
    const href = e.currentTarget.href;
    const targetId = href.replace(/.*\#/, "");

    if (pathname !== "/") {
      router.push(`/#${targetId}`);
      return;
    }

    const elem = document.getElementById(targetId);
    elem?.scrollIntoView({ behavior: "smooth" });
  };

  const navLinks = [
    { href: "#how-it-works", label: "How it works?", scroll: true },
    { href: "#features", label: "Features", scroll: true },
    { href: "#pricing", label: "Pricing", scroll: true },
    { href: "/0g", label: "0G", scroll: false },
    { href: "/demo", label: "Demo", scroll: false },
    { href: "/docs", label: "Docs", scroll: false },
  ];

  return (
    <div className="fixed top-4 md:top-6 left-0 right-0 z-50 flex justify-center px-4 md:px-6">
      <nav className="relative grid h-[60px] md:h-[72px] w-full max-w-5xl grid-cols-[auto_1fr_auto] items-center rounded-full border border-black/5 bg-[var(--color-bg-base)]/70 px-4 md:px-6 shadow-sm backdrop-blur-md transition-all duration-300">
        {/* Logo */}
        <Link href="/" className="inline-flex h-full items-center text-xl md:text-2xl font-black tracking-tighter text-[var(--color-brand-navy)] transition-transform hover:rotate-[-2deg]">
          coal
        </Link>

        {/* Desktop links */}
        <div className="hidden h-full items-center justify-center md:flex">
          <div className="flex h-full items-center gap-8 text-sm font-bold leading-none tracking-tight text-[var(--color-text-secondary)]">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={link.scroll ? handleScroll : undefined}
                className="inline-flex h-full items-center justify-center transition-all hover:-translate-y-0.5 hover:text-[var(--color-brand-orange)]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:inline-flex items-center justify-self-end">
          {authenticated ? (
            <Link href="/console">
              <button className="flex h-11 items-center gap-2 rounded-full bg-black px-6 text-sm font-bold text-white shadow-[4px_4px_0px_0px_#FF5C16] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#FF5C16] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none">
                Console
                <ArrowRight2 size={16} variant="Linear" />
              </button>
            </Link>
          ) : (
            <Link href="/login">
              <button className="flex h-11 items-center gap-2 rounded-full bg-black px-6 text-sm font-bold text-white shadow-[4px_4px_0px_0px_#FF5C16] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#FF5C16] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none">
                Start Building
                <ArrowRight2 size={16} variant="Linear" />
              </button>
            </Link>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden inline-flex items-center justify-self-end w-10 h-10 items-center justify-center rounded-xl text-[var(--color-brand-navy)] hover:bg-black/5 transition-colors"
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <CloseSquare size={22} variant="Linear" />
          ) : (
            <HamburgerMenu size={22} variant="Linear" />
          )}
        </button>
      </nav>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="absolute top-[calc(100%+8px)] left-4 right-4 md:hidden bg-[var(--color-bg-base)]/95 backdrop-blur-lg border border-black/8 rounded-3xl shadow-lg p-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  if (link.scroll) {
                    handleScroll(e);
                  } else {
                    setMobileOpen(false);
                  }
                }}
                className="px-4 py-3 rounded-2xl text-sm font-bold text-[var(--color-brand-navy)] hover:bg-white/60 transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <div className="border-t border-black/5 mt-2 pt-3">
              {authenticated ? (
                <Link href="/console" onClick={() => setMobileOpen(false)}>
                  <button className="w-full flex items-center justify-center gap-2 h-11 rounded-full bg-black px-6 text-sm font-bold text-white shadow-[4px_4px_0px_0px_#FF5C16]">
                    Console
                    <ArrowRight2 size={16} variant="Linear" />
                  </button>
                </Link>
              ) : (
                <Link href="/login" onClick={() => setMobileOpen(false)}>
                  <button className="w-full flex items-center justify-center gap-2 h-11 rounded-full bg-black px-6 text-sm font-bold text-white shadow-[4px_4px_0px_0px_#FF5C16]">
                    Start Building
                    <ArrowRight2 size={16} variant="Linear" />
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
