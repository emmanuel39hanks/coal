const DEFAULT_API_URL = 'http://localhost:3001';

function isLoopbackHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

export function getApiBaseUrl() {
  const configuredUrl =
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    DEFAULT_API_URL;

  if (typeof window === 'undefined') {
    return configuredUrl;
  }

  try {
    const parsed = new URL(configuredUrl);
    const currentHostname = window.location.hostname;

    if (isLoopbackHost(parsed.hostname) && isLoopbackHost(currentHostname) && parsed.hostname !== currentHostname) {
      parsed.hostname = currentHostname;
      return parsed.toString().replace(/\/$/, '');
    }

    return parsed.toString().replace(/\/$/, '');
  } catch {
    return configuredUrl.replace(/\/$/, '');
  }
}
