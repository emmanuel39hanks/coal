'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import ConsoleSidebar from '@/components/ConsoleSidebar';

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { data: session, isPending } = authClient.useSession();
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        if (!isPending) {
            if (!session) {
                router.replace('/');
            } else {
                setIsChecking(false);
            }
        }
    }, [session, isPending, router]);

    if (isChecking) return null; // Or a loading spinner

    return (
        <div className="flex min-h-screen bg-[var(--color-bg-base)]">
            <ConsoleSidebar />
            <main className="flex-1 p-4 md:p-8 ml-0 md:ml-20 lg:ml-64 transition-all duration-300">
                <div className="max-w-6xl mx-auto pt-20 md:pt-0">
                    {children}
                </div>
            </main>
        </div>
    );
}
