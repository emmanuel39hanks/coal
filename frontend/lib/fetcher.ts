// Shared fetcher with credentials for cross-origin requests
export const fetcher = (url: string) =>
    fetch(url, {
        credentials: 'include'
    }).then((res) => res.json());

// API base URL helper
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
