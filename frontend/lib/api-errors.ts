type ApiErrorPayload = {
  code?: string;
  message?: string;
  requestId?: string;
  details?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function extractPayload(value: unknown): ApiErrorPayload {
  if (!isRecord(value)) {
    const message = asString(value);
    return message ? { message } : {};
  }

  const nested = isRecord(value.error) ? extractPayload(value.error) : {};
  const nestedMessage = asString(value.error) ?? nested.message;
  const message = asString(value.message) ?? nestedMessage;
  const code = asString(value.code) ?? nested.code;
  const requestId = asString(value.requestId) ?? nested.requestId;
  const details = value.details ?? nested.details;

  return {
    code,
    message,
    requestId,
    details,
  };
}

export class ApiRequestError extends Error {
  status?: number;
  code?: string;
  requestId?: string;
  details?: unknown;
  raw?: unknown;

  constructor(
    message: string,
    options: {
      status?: number;
      code?: string;
      requestId?: string;
      details?: unknown;
      raw?: unknown;
    } = {},
  ) {
    super(message);
    this.name = 'ApiRequestError';
    Object.setPrototypeOf(this, ApiRequestError.prototype);
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.details = options.details;
    this.raw = options.raw;
  }
}

export function getErrorMessage(error: unknown, fallback = 'Request failed'): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;

  const parsed = extractPayload(error);
  if (parsed.message) return parsed.message;

  return fallback;
}

export async function readApiError(response: Response): Promise<ApiRequestError> {
  const contentType = response.headers.get('content-type') || '';
  let body: unknown = null;

  try {
    if (contentType.includes('application/json')) {
      body = await response.json();
    } else {
      body = await response.text();
    }
  } catch {
    body = null;
  }

  const parsed = extractPayload(body);
  const fallbackMessage =
    parsed.message ||
    (response.status === 401 ? 'Unauthorized' : '') ||
    response.statusText ||
    'Request failed';

  return new ApiRequestError(fallbackMessage, {
    status: response.status,
    code: parsed.code,
    requestId: parsed.requestId,
    details: parsed.details,
    raw: body,
  });
}
