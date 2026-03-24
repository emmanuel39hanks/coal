import { describe, it, expect } from 'vitest';
import { errors, apiSuccess, apiError } from '@/lib/errors';

// NextResponse.json returns a Response-like object; we can read it with .json()
async function jsonBody(response: Response): Promise<unknown> {
  return response.json();
}

describe('errors.unauthorized', () => {
  it('returns HTTP 401', () => {
    expect(errors.unauthorized().status).toBe(401);
  });

  it('body contains UNAUTHORIZED code', async () => {
    const body = await jsonBody(errors.unauthorized()) as any;
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('body contains a requestId', async () => {
    const body = await jsonBody(errors.unauthorized()) as any;
    expect(typeof body.error.requestId).toBe('string');
    expect(body.error.requestId).toMatch(/^req_/);
  });

  it('uses custom message when provided', async () => {
    const body = await jsonBody(errors.unauthorized('Token expired')) as any;
    expect(body.error.message).toBe('Token expired');
  });
});

describe('errors.notFound', () => {
  it('returns HTTP 404', () => {
    expect(errors.notFound('Product').status).toBe(404);
  });

  it('body contains correct message', async () => {
    const body = await jsonBody(errors.notFound('Product')) as any;
    expect(body.error.message).toBe('Product not found');
  });

  it('defaults to "Resource" when no argument', async () => {
    const body = await jsonBody(errors.notFound()) as any;
    expect(body.error.message).toBe('Resource not found');
  });

  it('body contains a requestId', async () => {
    const body = await jsonBody(errors.notFound('Link')) as any;
    expect(typeof body.error.requestId).toBe('string');
  });
});

describe('errors.validation', () => {
  it('returns HTTP 400', () => {
    expect(errors.validation({ field: ['error'] }).status).toBe(400);
  });

  it('body contains VALIDATION_ERROR code', async () => {
    const body = await jsonBody(errors.validation({ field: ['required'] })) as any;
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('body contains provided details', async () => {
    const details = { email: ['Invalid email'] };
    const body = await jsonBody(errors.validation(details)) as any;
    expect(body.error.details).toEqual(details);
  });

  it('body contains a requestId', async () => {
    const body = await jsonBody(errors.validation({})) as any;
    expect(typeof body.error.requestId).toBe('string');
  });
});

describe('errors.forbidden', () => {
  it('returns HTTP 403', () => {
    expect(errors.forbidden().status).toBe(403);
  });

  it('body contains FORBIDDEN code', async () => {
    const body = await jsonBody(errors.forbidden()) as any;
    expect(body.error.code).toBe('FORBIDDEN');
  });
});

describe('errors.rateLimited', () => {
  it('returns HTTP 429', () => {
    expect(errors.rateLimited().status).toBe(429);
  });

  it('body contains RATE_LIMITED code', async () => {
    const body = await jsonBody(errors.rateLimited()) as any;
    expect(body.error.code).toBe('RATE_LIMITED');
  });
});

describe('errors.internal', () => {
  it('returns HTTP 500', () => {
    expect(errors.internal().status).toBe(500);
  });

  it('uses custom message', async () => {
    const body = await jsonBody(errors.internal('DB down')) as any;
    expect(body.error.message).toBe('DB down');
  });
});

describe('errors.gone', () => {
  it('returns HTTP 410', () => {
    expect(errors.gone().status).toBe(410);
  });

  it('body contains GONE code', async () => {
    const body = await jsonBody(errors.gone()) as any;
    expect(body.error.code).toBe('GONE');
  });
});

describe('errors.conflict', () => {
  it('returns HTTP 409', () => {
    expect(errors.conflict('SLUG_TAKEN', 'That slug is already taken').status).toBe(409);
  });

  it('body contains custom code', async () => {
    const body = await jsonBody(errors.conflict('TXHASH_ALREADY_USED', 'Duplicate tx')) as any;
    expect(body.error.code).toBe('TXHASH_ALREADY_USED');
  });
});

describe('apiSuccess', () => {
  it('returns HTTP 200 by default', () => {
    expect(apiSuccess({ ok: true }).status).toBe(200);
  });

  it('body matches provided data', async () => {
    const data = { id: 'abc', amount: 10 };
    const body = await jsonBody(apiSuccess(data)) as any;
    expect(body).toEqual(data);
  });

  it('supports custom status code', () => {
    expect(apiSuccess({ created: true }, 201).status).toBe(201);
  });

  it('response includes X-Request-Id header', () => {
    const res = apiSuccess({ ok: true });
    expect(res.headers.get('X-Request-Id')).toMatch(/^req_/);
  });
});

describe('apiError', () => {
  it('includes X-Request-Id header matching body requestId', async () => {
    const res = apiError('NOT_FOUND', 'Not found', 404);
    const headerReqId = res.headers.get('X-Request-Id');
    const body = await jsonBody(res) as any;
    expect(headerReqId).toBe(body.error.requestId);
  });
});
