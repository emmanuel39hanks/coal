import { URL } from 'url';
import dns from 'dns/promises';

const BLOCKED_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^169\.254\./,  // link-local
  /^::1$/,        // IPv6 loopback
  /^fc00:/,       // IPv6 private
  /^fe80:/,       // IPv6 link-local
  /^::ffff:127\./, // IPv4-mapped loopback
  /^::ffff:10\./,  // IPv4-mapped private
  /^::ffff:172\.(1[6-9]|2[0-9]|3[01])\./,
  /^::ffff:192\.168\./,
  /^::ffff:169\.254\./,
];

const BLOCKED_HOSTS = ['localhost', 'metadata.google.internal', '169.254.169.254'];

function isBlockedIp(ip: string): boolean {
  return BLOCKED_RANGES.some(range => range.test(ip));
}

export async function validateWebhookUrl(urlString: string): Promise<{ valid: boolean; reason?: string }> {
  try {
    const url = new URL(urlString);

    if (!['https:', 'http:'].includes(url.protocol)) {
      return { valid: false, reason: 'Only HTTP/HTTPS URLs allowed' };
    }

    if (url.protocol === 'http:' && process.env.NODE_ENV === 'production') {
      return { valid: false, reason: 'HTTPS required in production' };
    }

    // Block userinfo in URL (e.g. http://user@evil.com@169.254.169.254/)
    if (url.username || url.password) {
      return { valid: false, reason: 'URLs with credentials not allowed' };
    }

    const host = url.hostname.toLowerCase();

    if (BLOCKED_HOSTS.includes(host)) {
      return { valid: false, reason: 'Blocked host' };
    }

    // String-based check for IP literals
    if (isBlockedIp(host)) {
      return { valid: false, reason: 'Private/internal IP addresses not allowed' };
    }

    // DNS resolution check — resolve the hostname and validate all IPs
    try {
      const ipv4Addresses = await dns.resolve4(host).catch(() => [] as string[]);
      const ipv6Addresses = await dns.resolve6(host).catch(() => [] as string[]);
      const allAddresses = [...ipv4Addresses, ...ipv6Addresses];

      for (const ip of allAddresses) {
        if (isBlockedIp(ip)) {
          return { valid: false, reason: 'Hostname resolves to a blocked IP address' };
        }
      }
    } catch {
      // DNS resolution failed — hostname may not exist, but we allow it
      // (the fetch will fail naturally if the hostname doesn't resolve)
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: 'Invalid URL' };
  }
}
