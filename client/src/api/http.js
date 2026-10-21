/**
 * The base URL of the API.
 *
 * `VITE_API_URL` holds the public address of the API and is baked into the
 * browser bundle, so it has to be set before the build. Without it the client
 * calls `/api` on its own origin, which only works when the hosting service
 * forwards that path to the API.
 *
 * Firebase Hosting forwards `/api/**` to a Cloud Run service of the same
 * project, but it does not forward it to an arbitrary external URL. When the
 * API is published on another host, the client therefore calls it cross-origin:
 * the API allows the origin of the frontend, and the session cookie is
 * `SameSite=None; Secure`.
 */
const API_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');

/**
 * An error returned by the API. Carries the status code and the machine
 * readable error code so the UI can react to it.
 */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Sends a request to the API.
 *
 * `credentials: 'include'` is required so the browser sends the session
 * cookie. The session is the only authentication mechanism, so a missing
 * cookie means the request is unauthenticated.
 */
export async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.code ?? 'REQUEST_FAILED',
      payload?.error?.message ?? 'The request could not be completed. Please try again.',
      payload?.error?.details
    );
  }

  return payload;
}
