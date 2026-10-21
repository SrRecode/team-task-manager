import { createContext } from 'react';

/**
 * Holds the authenticated user and the request status.
 *
 * `status` is one of:
 *   'loading'         the initial /auth/me request is still in flight
 *   'authenticated'   a session exists
 *   'unauthenticated' no session
 */
export const AuthContext = createContext(null);
