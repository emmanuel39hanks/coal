'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This is a legacy placeholder page — actual payment pages are at /pay/[slug]
export default function PayPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/');
    }, [router]);

    return null;
}
