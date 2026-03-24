import { URL } from 'url';

const BLOCKED_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,  // link-local
  /^::1$/,        // IPv6 loopback
  /^fc00:/,       // IPv6 private
];

const BLOCKED_HOSTS = ['localhost', 'metadata.google.internal', '169.254.169.254'];

export function validateWebhookUrl(urlString: string): { valid: boolean; reason?: string } {
  try {
    const url = new URL(urlString);

    if (!['https:', 'http:'].includes(url.protocol)) {
      return { valid: false, reason: 'Only HTTP/HTTPS URLs allowed' };
    }

    if (url.protocol === 'http:' && process.env.NODE_ENV === 'production') {
      return { valid: false, reason: 'HTTPS required in production' };
    }

    const host = url.hostname.toLowerCase();

    if (BLOCKED_HOSTS.includes(host)) {
      return { valid: false, reason: 'Blocked host' };
    }

    for (const range of BLOCKED_RANGES) {
      if (range.test(host)) {
        return { valid: false, reason: 'Private/internal IP addresses not allowed' };
      }
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: 'Invalid URL' };
  }
}
