# Coal Backend Security Architecture

Coal keeps a clear split between public merchant integration and internal dashboard access. Merchant API requests use `x-api-key` with `coal_live_*` keys, while the console uses Privy-issued Bearer JWTs.

## Authentication

Coal has two separate auth surfaces:

- Merchant API requests use `x-api-key` with keys in the `coal_live_*` format.
- Dashboard and internal `/api/console/*` routes use `Authorization: Bearer <Privy JWT>`.

Public checkout and payment-status routes do not require auth, but they are rate-limited.

## Merchant API Keys

- Full keys are shown only once when created in the Console.
- The backend stores only a SHA-256 hash of each key in `secretHash`.
- Keys can be revoked, and revoked keys are rejected on subsequent requests.
- `coal_live_*` is the canonical prefix and should be used in docs, logs, and examples.

## Rate Limiting

`lib/rate-limit.ts` implements a sliding-window limiter using Upstash Redis in production and an in-memory fallback for development. Limits:

| Limiter  | Requests | Window |
|----------|----------|--------|
| auth     | 5        | 1 min  |
| checkout | 10       | 1 min  |
| confirm  | 5        | 1 min  |
| console  | 60       | 1 min  |
| public   | 30       | 1 min  |

Exceeding the limit returns HTTP 429 with `Retry-After` headers.

## SSRF Protection

Webhook URLs submitted by merchants are validated by `lib/ssrf.ts` before any outbound HTTP request is made. Blocked destinations:

- `localhost`, `127.x.x.x`, `::1`
- RFC-1918 private ranges (10.x, 172.16-31.x, 192.168.x)
- Link-local (169.254.x)
- Loopback (0.0.0.0)
- Non-HTTP/HTTPS schemes

## Sanctions Screening

`lib/sanctions.ts` checks wallet addresses against the Chainalysis oracle on Base before processing payments. The check is fail-open: if the oracle is unavailable, the payment is allowed and a warning is logged. Sanctioned addresses receive a 403 with code `SANCTIONS_MATCH`.

## Webhook Signing

Outbound webhooks are HMAC-SHA256 signed with a per-merchant secret stored as `webhookSecret` on the user record. Merchants verify delivery authenticity by checking the `X-Coal-Signature` header.

## Input Validation

All POST and PUT endpoints validate request bodies with Zod schemas. Invalid input returns 400 with field-level errors.

## Logging

Structured JSON logging uses Pino. Sensitive fields such as tokens, secrets, and raw API keys must never be logged. Production logs stream to stdout for the hosting platform.

## Error Handling

Unhandled exceptions return a generic 500 with `{ error: { code: "INTERNAL_ERROR" } }`. Stack traces and internal details are not exposed to clients.
