'use client';

interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    color?: string;
}

const SIZES = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
};

const STROKE = {
    sm: 2.5,
    md: 3,
    lg: 3.5,
};

export default function Spinner({ size = 'md', color = '#FF5C16' }: SpinnerProps) {
    const dim = SIZES[size];
    const stroke = STROKE[size];

    return (
        <svg
            className={`animate-spin ${dim}`}
            viewBox="0 0 24 24"
            fill="none"
            aria-label="Loading"
        >
            {/* Track */}
            <circle
                cx="12" cy="12" r="10"
                stroke="currentColor"
                strokeWidth={stroke}
                className="opacity-15"
            />
            {/* Indicator */}
            <path
                fill={color}
                className="opacity-90"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
        </svg>
    );
}
