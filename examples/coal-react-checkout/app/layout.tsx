'use client';

import { useState } from 'react';
import './globals.css';

const NAV: { href: string; label: string }[] = [
  { href: '/', label: 'Home' },
  { href: '/checkout', label: 'Checkout' },
  { href: '/paywall', label: 'Paywall' },
  { href: '/agent', label: 'Agent' },
  { href: '/subscription', label: 'Subscriptions' },
  { href: '/splits', label: 'Splits' },
  { href: '/embed', label: 'SDK' },
  { href: '/webhook', label: 'Webhooks' },
];

function NavBar() {
  const [open, setOpen] = useState(false);

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(245,242,237,0.9)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(0,0,0,0.07)',
      padding: '0 16px', height: '52px',
      display: 'flex', alignItems: 'center', gap: '4px',
    }}>
      <a href="/" style={{ fontSize: '18px', fontWeight: 900, color: '#180D43', textDecoration: 'none', letterSpacing: '-0.04em', marginRight: '12px', flexShrink: 0 }}>coal</a>

      {/* Desktop nav links */}
      <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1, overflowX: 'auto' }}>
        {NAV.map(({ href, label }) => (
          <a key={href} href={href} style={{ fontSize: '12px', fontWeight: 700, color: '#6B7280', textDecoration: 'none', padding: '5px 8px', borderRadius: '8px', flexShrink: 0, whiteSpace: 'nowrap' }}>
            {label}
          </a>
        ))}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <a href="https://www.npmjs.com/package/coal-react" target="_blank" rel="noopener noreferrer"
          style={{ fontSize: '11px', fontWeight: 700, color: '#FF5C16', textDecoration: 'none', border: '1.5px solid #FF5C16', borderRadius: '999px', padding: '4px 12px', flexShrink: 0, whiteSpace: 'nowrap' }}>
          coal-react
        </a>

        {/* Mobile hamburger */}
        <button
          className="nav-mobile-toggle"
          onClick={() => setOpen(!open)}
          style={{ display: 'none', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', background: 'none', border: '1.5px solid rgba(0,0,0,0.1)', borderRadius: '10px', cursor: 'pointer', fontSize: '16px' }}
          aria-label="Toggle menu"
        >
          {open ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="nav-mobile-menu" style={{ display: 'none' }}>
          {NAV.map(({ href, label }) => (
            <a key={href} href={href} onClick={() => setOpen(false)} style={{ fontSize: '13px', fontWeight: 700, color: '#180D43', textDecoration: 'none', padding: '10px 12px', borderRadius: '10px' }}>
              {label}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Coal Demo Kitchen</title>
        <meta name="description" content="Every Coal feature, from human checkout to full AI agent payments" />
      </head>
      <body style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#f5f2ed', color: '#180D43' }}>
        <NavBar />
        {children}
      </body>
    </html>
  );
}
