import { getApiBaseUrl } from '@/lib/api-base';

// Shared fetcher with credentials for cross-origin requests
export const fetcher = (url: string) =>
    fetch(url, {
        credentials: 'include'
    }).then((res) => res.json());

export function getApiUrl() {
    return getApiBaseUrl();
}
