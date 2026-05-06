/**
 * Thin fetch wrapper for dashboard → API calls.
 * Automatically attaches the X-POW-Request header required by verifyCsrf().
 */
export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers)
    headers.set("x-pow-request", "1")
    return fetch(input, { ...init, headers })
}
