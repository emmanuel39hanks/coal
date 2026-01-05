"use client";
import Link from 'next/link';
import { ArrowRight2 } from 'iconsax-reactjs';

export default function Navbar() {
  const handleScroll = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    e.preventDefault();
    const href = e.currentTarget.href;
    const targetId = href.replace(/.*\#/, "");
    const elem = document.getElementById(targetId);
    elem?.scrollIntoView({
      behavior: "smooth",
    });
  };

  return (
    <div className="fixed top-6 left-0 right-0 z-50 flex justify-center px-6">
      <nav className="w-full max-w-5xl bg-[var(--color-bg-base)]/70 backdrop-blur-md border border-black/5 rounded-full py-3 px-6 shadow-sm flex items-center justify-between transition-all duration-300 h-[72px]">
        {/* Logo */}
        <Link href="/" className="text-2xl font-black tracking-tighter text-[var(--color-brand-navy)] hover:rotate-[-2deg] transition-transform h-full flex items-center">
          coal
        </Link>

        {/* Links */}
        <div className="hidden md:flex items-center gap-8 font-bold text-sm tracking-tight text-[var(--color-text-secondary)] h-full">
          <Link href="#how-it-works" onClick={handleScroll} className="hover:text-[var(--color-brand-orange)] hover:-translate-y-0.5 transition-all flex items-center h-full">How it works?</Link>
          <Link href="#features" onClick={handleScroll} className="hover:text-[var(--color-brand-orange)] hover:-translate-y-0.5 transition-all flex items-center h-full">Features</Link>
          <Link href="#docs" onClick={handleScroll} className="hover:text-[var(--color-brand-orange)] hover:-translate-y-0.5 transition-all flex items-center h-full">Docs</Link>
        </div>

        {/* CTA */}
        <Link href="/login" className="flex items-center h-full">
          <button className="bg-black text-white px-6 py-2.5 rounded-full flex items-center gap-2 text-sm font-bold shadow-[4px_4px_0px_0px_#FF5C16] hover:shadow-[2px_2px_0px_0px_#FF5C16] hover:translate-x-[2px] hover:translate-y-[2px] transition-all active:shadow-none active:translate-x-[4px] active:translate-y-[4px]">
            Start Building
            <ArrowRight2 size={16} variant="Linear" />
          </button>
        </Link>
      </nav>
    </div>
  );
}
