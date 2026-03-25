import { useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { readApiError } from '@/lib/api-errors';
import { getApiBaseUrl } from '@/lib/api-base';

export function getApiUrl() {
  return getApiBaseUrl();
}

// Read the active workspace from localStorage directly so this works
// in both hook and non-hook contexts (e.g. SWR fetcher callbacks).
function getStoredWorkspaceId(): string | null {
  try {
    return localStorage.getItem('coal:workspaceId');
  } catch {
    return null;
  }
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  getToken?: () => Promise<string | null>
): Promise<Response> {
  const token = getToken ? await getToken() : null;
  const workspaceId = getStoredWorkspaceId();
  return fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Pass active workspace so backend uses the correct merchantId
      ...(workspaceId ? { 'x-workspace-id': workspaceId } : {}),
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
