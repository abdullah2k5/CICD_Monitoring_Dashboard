import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const AuthContext = createContext(null);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  async function login(email, password) {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    setToken(data.token);
    setUser(data.user);
    return data;
  }

  async function register(name, email, password) {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    return data;
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  // Stores the session produced by the GitHub OAuth flow. Validates before
  // writing to state; throws so callers can surface the failure. Memoized so
  // the context value keeps a stable reference across renders.
  const setOAuthSession = useCallback((token, user) => {
    if (typeof token !== 'string' || token.trim() === '') {
      throw new Error('OAuth session requires a non-empty token');
    }

    if (!user || typeof user !== 'object' || Array.isArray(user)) {
      throw new Error('OAuth session requires a valid user object');
    }

    setToken(token);
    setUser(user);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      login,
      register,
      logout,
      setOAuthSession,
    }),
    [user, token, setOAuthSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
