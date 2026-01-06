// API URL for direct backend calls (bypasses rewrites for cookie handling)
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Fetcher with credentials for cross-origin cookie handling
export const fetcher = (url: string) =>
    fetch(`${API_URL}${url}`, {
        credentials: 'include'
    }).then((res) => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
    });

// POST/PUT/DELETE helper with credentials
export async function apiRequest(url: string, options: RequestInit = {}) {
    const response = await fetch(`${API_URL}${url}`, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        }
    });

    if (!response.ok) {
        throw new Error('Request failed');
    }

    return response.json();
}
