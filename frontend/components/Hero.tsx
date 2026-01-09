'use client';

import { authClient } from '@/lib/auth-client';
import Link from 'next/link';
import { ArrowRight, Code } from 'iconsax-reactjs';
import BlurReveal from './BlurReveal';

export default function Hero() {
    const session = authClient.useSession();
    const user = session.data?.user;

    return (
        <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
            {/* Fun Animated Background */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[var(--color-brand-orange)]/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/4 z-0 pointer-events-none animate-pulse" />
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[var(--color-brand-blue)]/20 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4 z-0 pointer-events-none" />

            <div className="container mx-auto px-6 relative z-10 text-center">

                <BlurReveal delay={0.1}>
                    <h1 className="text-massive tracking-tighter text-[var(--color-brand-navy)] mb-6 flex flex-col items-center leading-[0.9]">
                        <span>Programmable</span>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-brand-orange)] to-[#FF8F50]">
                            Commerce
                        </span>
                    </h1>

                </BlurReveal>

                <BlurReveal delay={0.3}>
                    <p className="text-xl md:text-2xl text-[var(--color-text-secondary)] max-w-3xl mx-auto mb-10 leading-relaxed font-medium">
                        Accept MNEE stablecoin. <span className="text-[var(--color-brand-navy)] font-bold">Split money automatically.</span> Settle instantly.
                        No smart contracts. Just one API.
                    </p>
                </BlurReveal>

                <BlurReveal delay={0.5}>
                    <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                        {user ? (
                            <Link href="/console">
                                <button className="group bg-black text-white btn-pill text-lg flex items-center gap-2 shadow-[6px_6px_0px_0px_#FF5C16] hover:shadow-[3px_3px_0px_0px_#FF5C16] hover:translate-x-[3px] hover:translate-y-[3px] transition-all active:translate-x-[6px] active:translate-y-[6px] active:shadow-none">
                                    Go to Console
                                    <ArrowRight size={20} variant="Linear" className="group-hover:translate-x-1 transition-transform" />
                                </button>
                            </Link>
                        ) : (
                            <button className="group bg-black text-white btn-pill text-lg flex items-center gap-2 shadow-[6px_6px_0px_0px_#FF5C16] hover:shadow-[3px_3px_0px_0px_#FF5C16] hover:translate-x-[3px] hover:translate-y-[3px] transition-all active:translate-x-[6px] active:translate-y-[6px] active:shadow-none">
                                Get API Key
                                <ArrowRight size={20} variant="Linear" className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        )}

                        <Link href="/docs">
                            <button className="group bg-white text-[var(--color-text-primary)] btn-pill text-lg flex items-center gap-2 shadow-[6px_6px_0px_0px_#180D43] hover:shadow-[3px_3px_0px_0px_#180D43] hover:translate-x-[3px] hover:translate-y-[3px] transition-all active:translate-x-[6px] active:translate-y-[6px] active:shadow-none border border-black/5">
                                View Docs
                                <Code size={20} variant="Linear" className="text-[var(--color-brand-orange)]" />
                            </button>
                        </Link>
                    </div>
                </BlurReveal>

                <BlurReveal delay={0.7} className="mt-32 relative">
                    <div className="relative rounded-[20px] bg-white border-4 border-white/50 shadow-[0px_10px_30px_-10px_rgba(0,0,0,0.1)] p-2 backdrop-blur-sm mx-auto max-w-5xl group hover:scale-[1.01] transition-transform duration-700">
                        <div className="absolute inset-0 bg-gradient-to-tr from-[var(--color-brand-orange)]/5 to-[var(--color-brand-blue)]/5 rounded-[20px] pointer-events-none" />
                        <img
                            src="/dashboard-preview.png"
                            alt="Coal Dashboard Preview"
                            width={1200}
                            height={675}
                            className="rounded-[12px] w-full h-auto shadow-inner border border-black/5"
                        />
                        {/* Shine Effect */}
                        <div className="absolute inset-0 rounded-[20px] bg-gradient-to-tr from-white/0 via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                    </div>
                </BlurReveal>
            </div>
        </section>
    );
}
