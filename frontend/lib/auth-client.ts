// Privy is the auth provider — hooks are used directly from @privy-io/react-auth
// This file provides a helper to attach the Privy JWT to API calls

export async function getAuthHeaders(): Promise<HeadersInit> {
  // getAccessToken is called from components via usePrivy()
  // This helper is for non-hook contexts — import usePrivy in components instead
  return {};
}
