import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Coal React Example',
  description: 'Working checkout examples powered by coal-react',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#f5f2ed' }}>
        <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(245,242,237,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0,0,0,0.06)', padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', gap: '24px' }}>
          <a href="/" style={{ fontSize: '16px', fontWeight: 900, color: '#180D43', textDecoration: 'none', letterSpacing: '-0.04em' }}>coal</a>
          <a href="/" style={{ fontSize: '13px', fontWeight: 700, color: '#6B7280', textDecoration: 'none' }}>Plan Selector</a>
          <a href="/embed" style={{ fontSize: '13px', fontWeight: 700, color: '#6B7280', textDecoration: 'none' }}>Redirect Checkout</a>
          <a href="https://www.npmjs.com/package/coal-react" target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 700, color: '#FF5C16', textDecoration: 'none', border: '1px solid #FF5C16', borderRadius: '999px', padding: '4px 12px' }}>npm: coal-react</a>
        </nav>
        {children}
      </body>
    </html>
  );
}
