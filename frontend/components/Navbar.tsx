"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowRight2 } from 'iconsax-reactjs';
import { useAuth as usePrivy } from '@/lib/auth';

export default function Navbar() {
  const { authenticated } = usePrivy();
  const pathname = usePathname();
  const router = useRouter();

  const handleScroll = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    e.preventDefault();
    const href = e.currentTarget.href;
    const targetId = href.replace(/.*\#/, "");

    if (pathname !== "/") {
      router.push(`/#${targetId}`);
      return;
    }

    const elem = document.getElementById(targetId);
    elem?.scrollIntoView({
      behavior: "smooth",
    });
  };

  return (
    <div className="fixed top-6 left-0 right-0 z-50 flex justify-center px-6">
      <nav className="grid h-[72px] w-full max-w-5xl grid-cols-[auto_1fr_auto] items-center rounded-full border border-black/5 bg-[var(--color-bg-base)]/70 px-6 shadow-sm backdrop-blur-md transition-all duration-300">
        {/* Logo */}
        <Link href="/" className="inline-flex h-full items-center text-2xl font-black tracking-tighter text-[var(--color-brand-navy)] transition-transform hover:rotate-[-2deg]">
          coal
        </Link>

        {/* Links */}
        <div className="hidden h-full items-center justify-center md:flex">
          <div className="flex h-full items-center gap-8 text-sm font-bold leading-none tracking-tight text-[var(--color-text-secondary)]">
            <Link href="#how-it-works" onClick={handleScroll} className="inline-flex h-full items-center justify-center transition-all hover:-translate-y-0.5 hover:text-[var(--color-brand-orange)]">How it works?</Link>
            <Link href="#features" onClick={handleScroll} className="inline-flex h-full items-center justify-center transition-all hover:-translate-y-0.5 hover:text-[var(--color-brand-orange)]">Features</Link>
            <Link href="#pricing" onClick={handleScroll} className="inline-flex h-full items-center justify-center transition-all hover:-translate-y-0.5 hover:text-[var(--color-brand-orange)]">Pricing</Link>
            <Link href="/0g" className="inline-flex h-full items-center justify-center transition-all hover:-translate-y-0.5 hover:text-[var(--color-brand-orange)]">0G</Link>
            <Link href="/docs" className="inline-flex h-full items-center justify-center transition-all hover:-translate-y-0.5 hover:text-[var(--color-brand-orange)]">Docs</Link>
          </div>
        </div>

        {/* CTA */}
        {authenticated ? (
          <Link href="/console" className="inline-flex items-center justify-self-end">
            <button className="flex h-11 items-center gap-2 rounded-full bg-black px-6 text-sm font-bold text-white shadow-[4px_4px_0px_0px_#FF5C16] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#FF5C16] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none">
              Console
              <ArrowRight2 size={16} variant="Linear" />
            </button>
          </Link>
        ) : (
          <Link href="/login" className="inline-flex items-center justify-self-end">
            <button className="flex h-11 items-center gap-2 rounded-full bg-black px-6 text-sm font-bold text-white shadow-[4px_4px_0px_0px_#FF5C16] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_#FF5C16] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none">
              Start Building
              <ArrowRight2 size={16} variant="Linear" />
            </button>
          </Link>
        )}
      </nav>
    </div>
  );
}
