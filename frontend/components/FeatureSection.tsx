import { Icon } from 'iconsax-reactjs';
import BlurReveal from './BlurReveal';

interface FeatureCardProps {
    icon: Icon;
    title: string;
    description: string;
    className?: string; // For passing rotation/margin
    color?: string; // For fun distinct colors
    delay?: number;
}

export function FeatureCard({ icon: Icon, title, description, className, color = "bg-white", delay = 0 }: FeatureCardProps) {
    return (
        <BlurReveal delay={delay} className={`h-full`}>
            <div className={`p-8 md:p-10 ${color} card-rounded border-2 border-black/5 ${className} transition-transform hover:scale-105 hover:rotate-0 duration-300 h-full`}>
                <div className="w-14 h-14 rounded-2xl bg-[var(--color-bg-base)] flex items-center justify-center mb-6 border border-black/5">
                    <Icon size={28} variant="Bold" className="text-[var(--color-brand-navy)]" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-[var(--color-brand-navy)] tracking-tight leading-tight">{title}</h3>
                <p className="text-[var(--color-text-secondary)] leading-relaxed text-sm md:text-base font-medium">{description}</p>
            </div>
        </BlurReveal>
    );
}

export default function FeatureSection({ title, children, id }: { title: string, children: React.ReactNode, id?: string }) {
    return (
        <section id={id} className="py-32">
            <div className="container mx-auto px-6">
                <BlurReveal>
                    <h2 className="text-4xl md:text-5xl font-bold text-center mb-20 text-[var(--color-brand-navy)] tracking-tighter">
                        {title}
                    </h2>
                </BlurReveal>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 px-4">
                    {children}
                </div>
            </div>
        </section>
    );
}
