
import { notFound } from "next/navigation";
import PaymentView from "@/components/PaymentView";
import { getApiBaseUrl } from "@/lib/api-base";

async function getPaymentData(slug: string) {
    const apiBaseUrl = getApiBaseUrl();
    // Try to resolve as a payment link first (short slugs like "abc123")
    const linkRes = await fetch(`${apiBaseUrl}/api/resolve/link?slug=${slug}`, {
        cache: 'no-store'
    });

    if (linkRes.ok) {
        const linkData = await linkRes.json();
        return { data: linkData, type: 'link' as const };
    }

    // If not a link, try to resolve as a checkout session (longer UUIDs like "clv...")
    const sessionRes = await fetch(`${apiBaseUrl}/api/resolve/session?id=${slug}`, {
        cache: 'no-store'
    });

    if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        return { data: sessionData, type: 'session' as const };
    }

    // 410 = session exists but is expired — show expired UI instead of 404
    if (sessionRes.status === 410) {
        return { data: { expired: true }, type: 'session' as const };
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
