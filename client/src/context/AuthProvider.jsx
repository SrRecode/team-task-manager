import { useCallback, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/auth.api';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const [acceptedInvites, setAcceptedInvites] = useState([]);

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
    setAcceptedInvites(payload.data.acceptedInvites ?? []);
    setStatus('authenticated');
    return payload.data.user;
  }, []);

  const register = useCallback(async (details) => {
    const payload = await authApi.register(details);
    setUser(payload.data.user);
    setAcceptedInvites(payload.data.acceptedInvites ?? []);
    setStatus('authenticated');
    return payload.data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setAcceptedInvites([]);
      setStatus('unauthenticated');
    }
  }, []);

  const dismissAcceptedInvites = useCallback(() => setAcceptedInvites([]), []);

  const value = useMemo(
    () => ({
      user,
      status,
      login,
      register,
      logout,
      acceptedInvites,
      dismissAcceptedInvites,
    }),
    [user, status, login, register, logout, acceptedInvites, dismissAcceptedInvites]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
