import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function expandLoopbackOrigin(origin: string) {
    try {
        const parsed = new URL(origin);
        if (parsed.hostname === 'localhost') {
            parsed.hostname = '127.0.0.1';
            return parsed.toString().replace(/\/$/, '');
        }
        if (parsed.hostname === '127.0.0.1') {
            parsed.hostname = 'localhost';
            return parsed.toString().replace(/\/$/, '');
        }
    } catch {
        return null;
    }

    return null;
}

function isLoopbackOrigin(origin: string) {
    try {
        const parsed = new URL(origin);
        return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    } catch {
        return false;
    }
}

const configuredOrigins = [
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3100',
    'http://127.0.0.1:3100',
    'https://usecoal.xyz',
    'https://www.usecoal.xyz',
    'https://console.usecoal.xyz',
];

const ALLOWED_ORIGINS = Array.from(new Set(
    configuredOrigins.flatMap((origin) => {
        const alias = expandLoopbackOrigin(origin);
        return alias ? [origin, alias] : [origin];
    }),
));

const CORS_HEADERS = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Authorization, Coal-Signature',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
};

export function proxy(request: NextRequest) {
    const origin = request.headers.get('origin') || '';
    const isAllowed =
        ALLOWED_ORIGINS.includes(origin) ||
        origin.endsWith('.usecoal.xyz') ||
        isLoopbackOrigin(origin) ||
        !origin;

    // Handle preflight
    if (request.method === 'OPTIONS') {
        return new NextResponse(null, {
            status: 204,
            headers: {
                ...CORS_HEADERS,
                'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
            },
        });
    }

    const response = NextResponse.next();

    if (isAllowed && origin) {
        response.headers.set('Access-Control-Allow-Origin', origin);
        Object.entries(CORS_HEADERS).forEach(([k, v]) => response.headers.set(k, v));
    }

    // Security headers
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
        response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    return response;
}

export const config = {
    matcher: '/api/:path*',
};
