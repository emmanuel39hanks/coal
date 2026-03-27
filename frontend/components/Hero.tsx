'use client';

import Link from 'next/link';
import { ArrowRight, Code } from 'iconsax-reactjs';
import BlurReveal from './BlurReveal';
import { useAuth as usePrivy } from '@/lib/auth';

export default function Hero() {
    const { authenticated } = usePrivy();

    return (
        <section className="relative overflow-hidden pt-24 pb-10 md:pt-44 md:pb-18">
            <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
                <BlurReveal delay={0.1}>
                    <h1 className="text-massive tracking-tighter text-[var(--color-brand-navy)] mb-6 flex flex-col items-center leading-[0.9]">
                        <span>Accept any crypto.</span>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-brand-orange)] to-[#FF8F50]">
                            Settle instantly.
                        </span>
                    </h1>
                </BlurReveal>

                <BlurReveal delay={0.3}>
                    <p className="text-base md:text-2xl text-[var(--color-text-secondary)] max-w-3xl mx-auto mb-8 md:mb-10 leading-relaxed font-medium">
                        Non-custodial checkout for any ERC-20 token.{' '}
                        <span className="text-[var(--color-brand-navy)] font-bold">Integrate in minutes,</span>{' '}
                        settle direct to your wallet.
                    </p>
                </BlurReveal>

                <BlurReveal delay={0.5}>
                    <div className="flex flex-col items-center gap-4 md:gap-5">
                        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                            {authenticated ? (
                                <Link href="/console">
                                    <button className="group bg-black text-white btn-pill text-lg flex items-center gap-2 shadow-[6px_6px_0px_0px_#FF5C16] hover:shadow-[3px_3px_0px_0px_#FF5C16] hover:translate-x-[3px] hover:translate-y-[3px] transition-all active:translate-x-[6px] active:translate-y-[6px] active:shadow-none">
                                        Go to Console
                                        <ArrowRight size={20} variant="Linear" className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </Link>
                            ) : (
                                <Link href="/signup">
                                    <button className="group bg-black text-white btn-pill text-lg flex items-center gap-2 shadow-[6px_6px_0px_0px_#FF5C16] hover:shadow-[3px_3px_0px_0px_#FF5C16] hover:translate-x-[3px] hover:translate-y-[3px] transition-all active:translate-x-[6px] active:translate-y-[6px] active:shadow-none">
                                        Start for free
                                        <ArrowRight size={20} variant="Linear" className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </Link>
                            )}

                            <Link href="/docs">
                                <button className="group bg-white text-[var(--color-text-primary)] btn-pill text-lg flex items-center gap-2 shadow-[6px_6px_0px_0px_#180D43] hover:shadow-[3px_3px_0px_0px_#180D43] hover:translate-x-[3px] hover:translate-y-[3px] transition-all active:translate-x-[6px] active:translate-y-[6px] active:shadow-none border border-black/5">
                                    View docs
                                    <Code size={20} variant="Linear" className="text-[var(--color-brand-orange)]" />
                                </button>
                            </Link>
                        </div>

                        <Link href="/demo">
                            <button className="group inline-flex items-center gap-1.5 text-lg font-bold text-[var(--color-brand-orange)] underline decoration-[var(--color-brand-orange)]/40 underline-offset-4 transition-all hover:gap-2.5 hover:decoration-[var(--color-brand-orange)]">
                                Try it live
                                <ArrowRight size={18} variant="Linear" className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </Link>
                    </div>
                </BlurReveal>

                <BlurReveal delay={0.7} className="relative mt-16 md:mt-28">
                    <div className="relative rounded-[20px] bg-white border-4 border-white/50 shadow-[0px_10px_30px_-10px_rgba(0,0,0,0.1)] p-2 backdrop-blur-sm mx-auto max-w-5xl group hover:scale-[1.01] transition-transform duration-700">
                        <div className="absolute inset-0 bg-gradient-to-tr from-[var(--color-brand-orange)]/5 to-[var(--color-brand-blue)]/5 rounded-[20px] pointer-events-none" />
                        <img
                            src="/dashboard-preview.png"
                            alt="Coal Dashboard Preview"
                            width={1200}
                            height={675}
                            className="rounded-[12px] w-full h-auto shadow-inner border border-black/5"
                        />
                        <div className="absolute inset-0 rounded-[20px] bg-gradient-to-tr from-white/0 via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                    </div>
                </BlurReveal>
            </div>
        </section>
    );
}
