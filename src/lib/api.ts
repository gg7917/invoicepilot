/**
 * Authenticated fetch helper for NudgePay.
 * Automatically attaches the Bearer session token from localStorage
 * to ensure bulletproof API calls in iframes, cross-origin previews, and incognito tabs.
 */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('nudgepay_token') : null;
  const headers = new Headers(init?.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
