import Link from 'next/link';
import Navbar from './Navbar';
import Footer from './Footer';
import BlurReveal from './BlurReveal';

type LegalSection = {
  title: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
};

function sectionId(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function LegalPage({
  eyebrow,
  title,
  description,
  lastUpdated,
  sections,
}: {
  eyebrow: string;
  title: string;
  description: string;
  lastUpdated: string;
  sections: readonly LegalSection[];
}) {
  return (
    <main className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-brand-navy)]">
      <Navbar />

      <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(255,92,22,0.16),transparent_28%),radial-gradient(circle_at_left_22%,rgba(67,98,209,0.14),transparent_22%),linear-gradient(180deg,#f8f5ef_0%,#f5f2ed_62%,#f5f2ed_100%)]">
        <section className="pt-32 pb-14 md:pt-44 md:pb-18">
          <div className="container mx-auto px-6">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
              <BlurReveal>
                <div className="max-w-4xl">
                  <div className="mb-5 inline-flex rounded-full border border-black/8 bg-white/80 px-4 py-1.5 text-xs font-black uppercase tracking-[0.24em] text-[var(--color-brand-orange)] shadow-sm backdrop-blur-sm">
                    {eyebrow}
                  </div>
                  <h1 className="max-w-4xl text-5xl font-black tracking-tighter text-[var(--color-brand-navy)] md:text-7xl">
                    {title}
                  </h1>
                  <p className="mt-6 max-w-3xl text-lg font-medium leading-relaxed text-[var(--color-text-secondary)] md:text-xl">
                    {description}
                  </p>
                </div>
              </BlurReveal>

              <BlurReveal delay={0.08}>
                <div className="rounded-[28px] border border-black/8 bg-white/88 p-6 shadow-[0_16px_40px_rgba(24,13,67,0.08)] backdrop-blur-sm">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
                    Quick facts
                  </p>
                  <div className="mt-5 space-y-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
                        Company
                      </p>
                      <p className="mt-1 text-sm font-bold text-[var(--color-brand-navy)]">
                        Coal by Schema Labs
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
                        Last updated
                      </p>
                      <p className="mt-1 text-sm font-bold text-[var(--color-brand-navy)]">
                        {lastUpdated}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
                        Contact
                      </p>
                      <a
                        href="mailto:hello@usecoal.xyz"
                        className="mt-1 inline-flex text-sm font-bold text-[var(--color-brand-orange)] underline decoration-[var(--color-brand-orange)]/35 underline-offset-4"
                      >
                        hello@usecoal.xyz
                      </a>
                    </div>
                  </div>
                </div>
              </BlurReveal>
            </div>
          </div>
        </section>
      </div>

      <section className="pb-24 pt-4">
        <div className="container mx-auto px-6">
          <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
            <BlurReveal className="lg:sticky lg:top-28 lg:self-start">
              <aside className="rounded-[28px] border border-black/8 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--color-text-secondary)]">
                  On this page
                </p>
                <nav className="mt-4 flex flex-col gap-2">
                  {sections.map((section) => (
                    <a
                      key={section.title}
                      href={`#${sectionId(section.title)}`}
                      className="rounded-2xl px-3 py-2 text-sm font-bold text-[var(--color-brand-navy)] transition-colors hover:bg-[var(--color-bg-base)] hover:text-[var(--color-brand-orange)]"
                    >
                      {section.title}
                    </a>
                  ))}
                </nav>
                <div className="mt-5 flex flex-col gap-2 border-t border-black/6 pt-5">
                  <Link
                    href="/"
                    className="rounded-2xl px-3 py-2 text-sm font-bold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-base)] hover:text-[var(--color-brand-orange)]"
                  >
                    Back to home
                  </Link>
                  <Link
                    href="/docs"
                    className="rounded-2xl px-3 py-2 text-sm font-bold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-base)] hover:text-[var(--color-brand-orange)]"
                  >
                    Read docs
                  </Link>
                </div>
              </aside>
            </BlurReveal>

            <div className="space-y-6">
              {sections.map((section, index) => (
                <BlurReveal key={section.title} delay={index * 0.04}>
                  <section
                    id={sectionId(section.title)}
                    className="scroll-mt-28 rounded-[32px] border border-black/8 bg-white p-8 shadow-sm md:p-10"
                  >
                    <h2 className="text-2xl font-black tracking-tight text-[var(--color-brand-navy)] md:text-3xl">
                      {section.title}
                    </h2>
                    <div className="mt-5 space-y-4">
                      {section.paragraphs.map((paragraph) => (
                        <p
                          key={paragraph}
                          className="text-base font-medium leading-8 text-[var(--color-text-secondary)]"
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>
                    {section.bullets?.length ? (
                      <ul className="mt-6 space-y-3">
                        {section.bullets.map((bullet) => (
                          <li
                            key={bullet}
                            className="flex gap-3 text-base font-medium leading-7 text-[var(--color-text-secondary)]"
                          >
                            <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--color-brand-orange)]" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </section>
                </BlurReveal>
              ))}

              <BlurReveal delay={0.16}>
                <section className="rounded-[32px] border border-[var(--color-brand-navy)]/10 bg-[var(--color-brand-navy)] px-8 py-8 text-white shadow-[0_20px_50px_rgba(24,13,67,0.14)] md:px-10">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-white/55">
                    Questions
                  </p>
                  <h2 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
                    Need anything clarified?
                  </h2>
                  <p className="mt-4 max-w-2xl text-base font-medium leading-8 text-white/72">
                    If you have questions about these policies, need a DPA, or want enterprise legal review before going live, email our team and we&apos;ll point you in the right direction.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <a
                      href="mailto:hello@usecoal.xyz"
                      className="inline-flex items-center rounded-full bg-white px-5 py-3 text-sm font-black text-[var(--color-brand-navy)] transition-transform hover:-translate-y-0.5"
                    >
                      Contact Schema Labs
                    </a>
                    <Link
                      href="/docs"
                      className="inline-flex items-center rounded-full border border-white/14 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-white/8"
                    >
                      Explore docs
                    </Link>
                  </div>
                </section>
              </BlurReveal>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
