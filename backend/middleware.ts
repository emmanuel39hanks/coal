import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Allowed origins for CORS
const allowedOrigins = [
    'https://usecoal.xyz',
    'https://www.usecoal.xyz',
    'http://localhost:3000',
    'http://localhost:3001',
];

export function middleware(request: NextRequest) {
    // Get origin from request
    const origin = request.headers.get('origin') || '';

    // Check if origin is allowed
    const isAllowedOrigin = allowedOrigins.includes(origin);

    // Handle preflight (OPTIONS) requests
    if (request.method === 'OPTIONS') {
        const response = new NextResponse(null, { status: 200 });

        if (isAllowedOrigin) {
            response.headers.set('Access-Control-Allow-Origin', origin);
        }
        response.headers.set('Access-Control-Allow-Credentials', 'true');
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version');
        response.headers.set('Access-Control-Max-Age', '86400');

        return response;
    }

    // Handle actual requests
    const response = NextResponse.next();

    if (isAllowedOrigin) {
        response.headers.set('Access-Control-Allow-Origin', origin);
    }
    response.headers.set('Access-Control-Allow-Credentials', 'true');

    return response;
}

// Only run middleware on API routes
export const config = {
    matcher: '/api/:path*',
};
