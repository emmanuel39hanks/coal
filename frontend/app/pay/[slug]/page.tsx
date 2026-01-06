
import { notFound } from "next/navigation";
import PaymentView from "@/components/PaymentView";

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function getPaymentData(slug: string) {
    // Try to resolve as a payment link first (short slugs like "abc123")
    const linkRes = await fetch(`${API_URL}/api/resolve/link?slug=${slug}`, {
        cache: 'no-store'
    });

    if (linkRes.ok) {
        const linkData = await linkRes.json();
        return { data: linkData, type: 'link' as const };
    }

    // If not a link, try to resolve as a checkout session (longer UUIDs like "clv...")
    const sessionRes = await fetch(`${API_URL}/api/resolve/session?id=${slug}`, {
        cache: 'no-store'
    });

    if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        return { data: sessionData, type: 'session' as const };
    }

    return null;
}

export default async function PaymentLinkPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const result = await getPaymentData(slug);

    if (!result) {
        notFound();
    }

    return <PaymentView data={result.data} type={result.type} />;
}
