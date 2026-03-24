import { NextResponse } from 'next/server';
import crypto from 'crypto';

export type ErrorCode =
    | 'VALIDATION_ERROR'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'NOT_FOUND'
    | 'CONFLICT'
    | 'GONE'
    | 'RATE_LIMITED'
    | 'INTERNAL_ERROR'
    | 'SESSION_NOT_FOUND'
    | 'SESSION_EXPIRED'
    | 'SESSION_ALREADY_CONFIRMED'
    | 'TXHASH_ALREADY_USED'
    | 'TXHASH_IN_ANOTHER_SESSION'
    | 'AMOUNT_MISMATCH'
    | 'RECIPIENT_MISMATCH'
    | 'TRANSACTION_REVERTED'
    | 'INVALID_API_KEY'
    | 'PRODUCT_NOT_FOUND'
    | 'LINK_NOT_FOUND'
    | 'SLUG_TAKEN'
    | 'INVALID_OPERATION';

function genRequestId() {
    return `req_${crypto.randomBytes(12).toString('hex')}`;
}

export function apiError(
    code: ErrorCode,
    message: string,
    status: number,
    details?: Record<string, unknown>
): NextResponse {
    const requestId = genRequestId();
    return NextResponse.json(
        { error: { code, message, requestId, ...(details && { details }) } },
        { status, headers: { 'X-Request-Id': requestId } }
    );
}

export function apiSuccess<T>(data: T, status = 200): NextResponse {
    const requestId = genRequestId();
    return NextResponse.json(data, {
        status,
        headers: { 'X-Request-Id': requestId },
    });
}

export const errors = {
    unauthorized: (message = 'Invalid or missing authentication') =>
        apiError('UNAUTHORIZED', message, 401),
    forbidden: (message = 'Access denied') =>
        apiError('FORBIDDEN', message, 403),
    notFound: (resource = 'Resource') =>
        apiError('NOT_FOUND', `${resource} not found`, 404),
    conflict: (code: ErrorCode, message: string) =>
        apiError(code, message, 409),
    gone: (message = 'Resource has expired') =>
        apiError('GONE', message, 410),
    validation: (details: Record<string, unknown>) =>
        apiError('VALIDATION_ERROR', 'Validation failed', 400, details),
    rateLimited: () =>
        apiError('RATE_LIMITED', 'Too many requests. Please try again later.', 429),
    internal: (message = 'Internal server error') =>
        apiError('INTERNAL_ERROR', message, 500),
};
