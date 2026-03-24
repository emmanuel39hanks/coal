import { useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { readApiError } from '@/lib/api-errors';
import { getApiBaseUrl } from '@/lib/api-base';

export function getApiUrl() {
  return getApiBaseUrl();
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  getToken?: () => Promise<string | null>
): Promise<Response> {
  const token = getToken ? await getToken() : null;
  return fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

// Hook that returns an authenticated SWR fetcher + mutation helper
export function useApi() {
  const { getAccessToken } = useAuth();

  const fetcher = useCallback(async (url: string) => {
    const res = await apiFetch(url, {}, getAccessToken);
    if (!res.ok) throw await readApiError(res);
    return res.json();
  }, [getAccessToken]);

  const request = useCallback(async (path: string, options: RequestInit = {}) => {
    const res = await apiFetch(path, options, getAccessToken);
    if (!res.ok) {
      throw await readApiError(res);
    }
    return res.json();
  }, [getAccessToken]);

  return { fetcher, request };
}

// Unauthenticated fetcher for public endpoints only
export const fetcher = (url: string) =>
  fetch(`${getApiBaseUrl()}${url}`).then(async (res) => {
    if (!res.ok) throw await readApiError(res);
    return res.json();
  });
