
import Link from 'next/link';

export default function SuccessPage() {
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
                <Link href="/">
                    <button className="w-full bg-black text-white h-14 rounded-full font-bold hover:scale-105 transition-transform">
                        Back to Shop
                    </button>
                </Link>
            </div>
        </div>
    );
}
