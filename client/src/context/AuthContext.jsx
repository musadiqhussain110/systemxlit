import policy from '../../../shared/rolePermissions.json';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/http';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(api.token));

  useEffect(() => {
    if (!api.token) return;
    api.get('/auth/me')
      .then(setUser)
      .catch(() => api.setToken(''))
      .finally(() => setLoading(false));
  }, []);

  async function completeAuthentication(path, payload) {
    const data = await api.post(path, payload);
    api.setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  function login(email, password) {
    return completeAuthentication('/auth/login', { email, password });
  }

  function register(details) {
    return completeAuthentication('/auth/register', details);
  }

  function setupAdmin(details) {
    return completeAuthentication('/auth/setup-admin', details);
  }

  function logout() {
    api.setToken('');
    setUser(null);
  }

  const value = useMemo(() => ({
    user,
    loading,
    login,
    register,
    setupAdmin,
    logout,
    isStaff: ['labStaff', 'coordinator', 'admin'].includes(user?.role),
    canBook: policy.capabilities['bookings.create'].includes(user?.role),
    can: capability => Boolean(policy.capabilities[capability]?.includes(user?.role)),
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
