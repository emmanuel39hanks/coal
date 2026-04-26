'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';

export interface ProductCardProps {
    linkSlug: string;
    linkId: string;
    name: string;
    description: string | null;
    price: string;
    image: string | null;
    merchantName: string | null;
}

export function ProductCard(props: ProductCardProps) {
    const router = useRouter();

    return (
        <button
            onClick={() => router.push(`/shop/${encodeURIComponent(props.linkSlug)}`)}
            className="text-left rounded-2xl bg-white border border-black/10 overflow-hidden active:scale-[0.98] transition-transform"
        >
            <div className="aspect-square w-full relative bg-black/5">
                {props.image ? (
                    <Image
                        src={props.image}
                        alt={props.name}
                        fill
                        sizes="(max-width: 640px) 50vw, 33vw"
                        className="object-cover"
                        unoptimized
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-3xl">
                        🛍️
                    </div>
                )}
            </div>
            <div className="p-2.5">
                <div className="text-[13px] font-black truncate text-[var(--color-brand-navy)]">
                    {props.name}
                </div>
                {props.merchantName && (
                    <div className="text-[10px] text-gray-400 truncate">{props.merchantName}</div>
                )}
                <div className="mt-1 text-[13px] font-bold text-[var(--color-brand-orange)]">
                    ${parseFloat(props.price).toFixed(2)}
                </div>
            </div>
        </button>
    );
}
