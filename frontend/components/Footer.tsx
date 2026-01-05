import { DocumentText } from 'iconsax-reactjs';

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
                <div className="flex flex-col md:flex-row w-full justify-between items-center mt-12 pt-12 border-t border-white/10 gap-8">
                    <p className="text-white/40 text-sm font-medium tracking-wide">
                        © 2026 BUILT FOR PROGRAMMABLE COMMERCE
                    </p>

                    <a
                        href="#docs"
                        className="group flex items-center gap-3 px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 transition-all border border-white/5"
                    >
                        <span className="font-bold text-white tracking-wide">Documentation</span>

                    </a>
                </div>
            </div>
        </footer>
    );
}
