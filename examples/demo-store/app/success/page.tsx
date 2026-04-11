
import Link from 'next/link';

// Next.js 15+ makes searchParams a Promise (async dynamic rendering).
export default async function SuccessPage({
    searchParams,
}: {
    searchParams: Promise<{ session_id?: string }>;
}) {
    const { session_id: sessionId } = await searchParams;

    return (
        <div className="min-h-screen bg-white flex items-center justify-center p-6">
            <div className="max-w-md w-full text-center">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8 text-6xl">
                    🎉
                </div>
                <h1 className="text-4xl font-black mb-4 tracking-tight">Order Confirmed!</h1>
                <p className="text-gray-500 mb-8 text-lg">
                    Thank you for your purchase. We've received your MNEE payment and your super coffee is on the way.
                </p>
                <div className="bg-gray-50 p-6 rounded-2xl mb-8 text-left border border-gray-100">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Integrations</p>
                    <div className="flex items-center gap-3 text-sm font-medium text-gray-600">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Webhook received via Coal API
                    </div>
                </div>
                {sessionId && (
                    <a
                        href={`${process.env.NEXT_PUBLIC_COAL_URL || 'http://localhost:3000'}/verify/${sessionId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full mb-4 bg-gray-100 text-gray-800 h-14 rounded-full font-bold hover:scale-105 transition-transform flex items-center justify-center gap-2"
                    >
                        Verify Receipt
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M5 11L11 5M11 5H6M11 5V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </a>
                )}
                <Link href="/">
                    <button className="w-full bg-black text-white h-14 rounded-full font-bold hover:scale-105 transition-transform">
                        Back to Shop
                    </button>
                </Link>
            </div>
        </div>
    );
}
