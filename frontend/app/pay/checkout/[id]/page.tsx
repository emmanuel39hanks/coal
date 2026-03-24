
import { notFound } from "next/navigation";
import PaymentView from "@/components/PaymentView";
import { getApiBaseUrl } from "@/lib/api-base";

async function getSession(id: string) {
    const res = await fetch(`${getApiBaseUrl()}/api/resolve/session?id=${id}`, {
        cache: 'no-store'
    });

    if (!res.ok) return null;
    return res.json();
}

export default async function CheckoutSessionPage({ params }: { params: { id: string } }) {
    const { id } = await params;
    const data = await getSession(id);

    if (!data) {
        notFound();
    }

    return <PaymentView data={data} type="session" />;
}
