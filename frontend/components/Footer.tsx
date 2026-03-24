import Link from 'next/link';

export default function Footer() {
    return (
        <footer className="bg-[var(--color-brand-navy)] text-white py-20 overflow-hidden relative">
            <div className="container mx-auto px-6 flex flex-col items-center">

                {/* Massive Text */}
                <div className="w-full text-center">
                    <h1 className="text-[14vw] leading-[0.8] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50 select-none">
                        COAL
                    </h1>
                </div>

                {/* Footer Content */}
                <div className="flex w-full flex-col gap-6 pt-18 md:flex-row md:items-center md:justify-between">
                    <div className="text-center md:text-left">
                        <p className="text-sm font-semibold tracking-wide text-white/70">
                            © 2026 Coal by Schema Labs. Built for programmable commerce.
                        </p>
                        <p className="mt-2 text-sm font-medium text-white/40">
                            Non-custodial payments, programmable revenue flows, and merchant-grade APIs.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 md:justify-end">
                        <Link
                            href="/docs"
                            className="group inline-flex items-center rounded-full border border-white/8 bg-white/10 px-5 py-3 text-sm font-bold text-white transition-all hover:bg-white/18"
                        >
                            Documentation
                        </Link>
                        <Link
                            href="/privacy"
                            className="group inline-flex items-center rounded-full border border-white/8 bg-white/6 px-5 py-3 text-sm font-bold text-white/84 transition-all hover:bg-white/12 hover:text-white"
                        >
                            Privacy Policy
                        </Link>
                        <Link
                            href="/terms"
                            className="group inline-flex items-center rounded-full border border-white/8 bg-white/6 px-5 py-3 text-sm font-bold text-white/84 transition-all hover:bg-white/12 hover:text-white"
                        >
                            Terms of Service
                        </Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
