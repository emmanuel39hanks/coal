import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Coal Demo Kitchen',
  description: 'Every Coal feature, from human checkout to full AI agent payments',
};

const NAV: { href: string; label: string }[] = [
  { href: '/', label: 'Home' },
  { href: '/checkout', label: 'Checkout' },
  { href: '/paywall', label: 'Paywall (x402)' },
  { href: '/agent', label: 'Agent' },
  { href: '/subscription', label: 'Subscriptions' },
  { href: '/splits', label: 'Splits' },
  { href: '/embed', label: 'SDK' },
  { href: '/webhook', label: 'Webhooks' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#f5f2ed', color: '#180D43' }}>
        <nav style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'rgba(245,242,237,0.9)', backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(0,0,0,0.07)',
          padding: '0 24px', height: '52px',
          display: 'flex', alignItems: 'center', gap: '4px',
          overflowX: 'auto',
        }}>
          <a href="/" style={{ fontSize: '18px', fontWeight: 900, color: '#180D43', textDecoration: 'none', letterSpacing: '-0.04em', marginRight: '16px', flexShrink: 0 }}>coal</a>
          {NAV.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280', textDecoration: 'none', padding: '5px 10px', borderRadius: '8px', flexShrink: 0, whiteSpace: 'nowrap', transition: 'color 0.15s ease, background 0.15s ease' }}
            >
              {label}
            </a>
          ))}
          <a href="https://www.npmjs.com/package/coal-react" target="_blank" rel="noopener noreferrer"
            style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 700, color: '#FF5C16', textDecoration: 'none', border: '1.5px solid #FF5C16', borderRadius: '999px', padding: '4px 12px', flexShrink: 0 }}>
            coal-react →
          </a>
        </nav>
        {children}
      </body>
    </html>
  );
}
