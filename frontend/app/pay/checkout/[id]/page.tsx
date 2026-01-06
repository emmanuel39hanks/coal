
import { notFound } from "next/navigation";
import PaymentView from "@/components/PaymentView";

async function getSession(id: string) {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/resolve/session?id=${id}`, {
        cache: 'no-store'
    });

    if (!res.ok) return null;
    return res.json();
}

export default async function CheckoutSessionPage({ params }: { params: { id: string } }) {
    const data = await getSession(params.id);

    if (!data) {
        notFound();
    }

    return <PaymentView data={data} type="session" />;
}
