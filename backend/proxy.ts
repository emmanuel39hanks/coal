
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
    // CORS logic
    const origin = request.headers.get('origin') ?? ''

    // Allow all usecoal.xyz subdomains and localhost for development
    const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://usecoal.xyz',
        'https://www.usecoal.xyz',
        'https://api.usecoal.xyz'
    ];

    const isAllowedOrigin = allowedOrigins.includes(origin) || !origin

    // Handle preflighted requests
    const isPreflight = request.method === 'OPTIONS'

    if (isPreflight) {
        const preflightHeaders = {
            ...(isAllowedOrigin && { 'Access-Control-Allow-Origin': origin }),
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie, X-API-Key, X-CSRF-Token, X-Requested-With',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400',
        }
        return NextResponse.json({}, { headers: preflightHeaders })
    }

    // Handle simple requests
    const response = NextResponse.next()

    if (isAllowedOrigin) {
        response.headers.set('Access-Control-Allow-Origin', origin)
    }

    response.headers.set('Access-Control-Allow-Credentials', 'true')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, X-API-Key, X-CSRF-Token, X-Requested-With')

    return response
}

export const config = {
    matcher: '/api/:path*',
}
