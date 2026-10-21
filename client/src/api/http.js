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
 * How long a request may take before it is aborted. A request that hangs
 * would leave the page in its loading state forever.
 */
export const REQUEST_TIMEOUT = 15000;

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
 *
 * Every request is aborted after `REQUEST_TIMEOUT` milliseconds. A caller can
 * pass its own `signal` to cancel a request earlier, for example when a
 * filter is changed while the previous request is still running.
 */
export async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      credentials: 'include',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch {
    if (controller.signal.aborted) {
      throw new ApiError(
        0,
        'REQUEST_TIMEOUT',
        'The API did not answer in time. Check the connection and try again.'
      );
    }

    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'The API could not be reached. Check the connection and try again.'
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const apiError = payload?.error;

    throw new ApiError(
      response.status,
      apiError?.code ?? 'REQUEST_FAILED',
      apiError?.message ?? `The request failed with the status ${response.status}.`,
      apiError?.details
    );
  }

  if (payload === null) {
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      'The API answered with a response the application does not understand.'
    );
  }

  return payload;
}
