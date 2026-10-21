import { useCallback, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/auth.api';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  /**
   * Asks the API who the current user is. A 401 is an expected outcome for a
   * visitor who is not signed in, so it is not treated as an app failure.
   */
  const refresh = useCallback(async () => {
    try {
      const payload = await authApi.me();
      setUser(payload.data.user);
      setStatus('authenticated');
    } catch {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const payload = await authApi.me();
        if (!active) return;
        setUser(payload.data.user);
        setStatus('authenticated');
      } catch {
        if (!active) return;
        setUser(null);
        setStatus('unauthenticated');
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const payload = await authApi.login(credentials);
    setUser(payload.data.user);
    setStatus('authenticated');
    return payload.data.user;
  }, []);

  const register = useCallback(async (details) => {
    const payload = await authApi.register(details);
    setUser(payload.data.user);
    setStatus('authenticated');
    return payload.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  const value = useMemo(
    () => ({ user, status, login, register, logout, refresh }),
    [user, status, login, register, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
