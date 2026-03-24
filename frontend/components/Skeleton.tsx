import React from 'react';
import { cn } from '@/lib/utils';

// Base shimmer block
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
    return (
        <div
            style={style}
            className={cn(
                'relative overflow-hidden rounded-xl bg-gray-100',
                'before:absolute before:inset-0 before:-translate-x-full',
                'before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent',
                'before:animate-[shimmer_1.5s_infinite]',
                className
            )}
        />
    );
}

// Stat card skeleton — matches the h-40 Overview/Analytics KPI cards
export function StatCardSkeleton() {
    return (
        <div className="bg-white p-6 rounded-[32px] border-2 border-black/5 flex flex-col justify-between h-40">
            <Skeleton className="w-12 h-12 rounded-2xl" />
            <div className="space-y-2">
                <Skeleton className="h-3.5 w-24 rounded-full" />
                <Skeleton className="h-8 w-36 rounded-lg" />
            </div>
        </div>
    );
}

// Table row skeleton — generic row with N columns
export function TableRowSkeleton({ cols, heights }: { cols: number; heights?: number[] }) {
    return (
        <tr>
            {Array.from({ length: cols }).map((_, i) => (
                <td key={i} className="py-4 px-4">
                    <Skeleton
                        className={`h-${heights?.[i] ?? 4} ${i === 0 ? 'w-40' : i === cols - 1 ? 'w-16 ml-auto' : 'w-24'} rounded-full`}
                    />
                </td>
            ))}
        </tr>
    );
}

// Chart area skeleton
export function ChartSkeleton({ height = 220 }: { height?: number }) {
    return (
        <div className="w-full" style={{ height }}>
            {/* Y axis */}
            <div className="flex gap-4 h-full">
                <div className="flex flex-col justify-between py-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-3 w-8 rounded-full" />
                    ))}
                </div>
                {/* Chart bars/line area */}
                <div className="flex-1 flex flex-col justify-between pb-6">
                    <div className="flex-1 relative">
                        <Skeleton className="absolute inset-0 rounded-2xl opacity-40" />
                        {/* Fake bars */}
                        <div className="absolute bottom-0 inset-x-0 flex items-end justify-around px-2 gap-2 h-full">
                            {[65, 40, 75, 55, 85, 45, 70, 50, 90, 60, 45, 80].map((h, i) => (
                                <Skeleton
                                    key={i}
                                    className="flex-1 rounded-t-lg"
                                    style={{ height: `${h}%` }}
                                />
                            ))}
                        </div>
                    </div>
                    {/* X axis ticks */}
                    <div className="flex justify-around pt-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton key={i} className="h-3 w-8 rounded-full" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Product card skeleton — matches the grid cards
export function ProductCardSkeleton() {
    return (
        <div className="bg-white p-6 rounded-[32px] border-2 border-black/5 space-y-4">
            <Skeleton className="w-full h-40 rounded-2xl" />
            <div className="space-y-2">
                <Skeleton className="h-5 w-3/4 rounded-full" />
                <Skeleton className="h-3.5 w-full rounded-full" />
                <Skeleton className="h-3.5 w-2/3 rounded-full" />
            </div>
            <div className="flex items-center justify-between pt-2">
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-8 w-8 rounded-full" />
            </div>
        </div>
    );
}

// Settings page skeleton
export function SettingsSkeleton() {
    return (
        <div className="space-y-8 max-w-2xl mx-auto">
            <div className="space-y-2">
                <Skeleton className="h-9 w-32 rounded-xl" />
                <Skeleton className="h-4 w-56 rounded-full" />
            </div>
            <div className="bg-white rounded-[40px] border-2 border-black/5 p-8 space-y-6">
                {[1, 2].map((i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-28 rounded-full ml-4" />
                        <Skeleton className="h-14 w-full rounded-full" />
                    </div>
                ))}
                <Skeleton className="h-14 w-full rounded-full mt-4" />
            </div>
        </div>
    );
}
