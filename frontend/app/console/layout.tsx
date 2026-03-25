'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth as usePrivy } from '@/lib/auth';
import ConsoleSidebar from '@/components/ConsoleSidebar';
import { WorkspaceProvider } from '@/lib/workspace';
import useSWR from 'swr';
import { useApi } from '@/lib/api';

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, authenticated } = usePrivy();
  const { fetcher } = useApi();
  const { data: onboarding } = useSWR(
    ready && authenticated ? '/api/console/onboarding' : null,
    fetcher
  );

  useEffect(() => {
    if (ready && !authenticated) {
      router.replace('/login');
    }
  }, [ready, authenticated, router]);

  useEffect(() => {
    if (
      ready &&
      authenticated &&
      onboarding &&
      pathname !== '/console/onboarding' &&
      onboarding.complete === false
    ) {
      router.replace('/console/onboarding');
    }
  }, [ready, authenticated, onboarding, pathname, router]);

  useEffect(() => {
    if (
      ready &&
      authenticated &&
      onboarding &&
      pathname === '/console/onboarding' &&
      onboarding.complete === true
    ) {
      router.replace('/console');
    }
  }, [ready, authenticated, onboarding, pathname, router]);

  if (!ready || !authenticated) return null;
  if (pathname !== '/console/onboarding' && !onboarding) return null;
  if (pathname !== '/console/onboarding' && onboarding?.complete === false) return null;
  if (pathname === '/console/onboarding' && onboarding?.complete === true) return null;

  return (
    <WorkspaceProvider>
      <div className="flex min-h-screen bg-[var(--color-bg-base)]">
        <ConsoleSidebar />
        <main className="flex-1 p-4 md:p-8 ml-0 md:ml-20 lg:ml-64 transition-all duration-300">
          <div className="max-w-6xl mx-auto pt-20 md:pt-0">
            {children}
          </div>
        </main>
      </div>
    </WorkspaceProvider>
  );
}
