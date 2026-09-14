import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const AuthContext = createContext(null);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

const TOKEN_STORAGE_KEY = 'auth_token';
const USER_STORAGE_KEY = 'auth_user';

function getStoredSession() {
  try {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    const storedUser = localStorage.getItem(USER_STORAGE_KEY);

    if (!storedToken || !storedUser) {
      return { token: null, user: null };
    }

    const parsedUser = JSON.parse(storedUser);

    if (!parsedUser || typeof parsedUser !== 'object' || Array.isArray(parsedUser)) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
      return { token: null, user: null };
    }

    return {
      token: storedToken,
      user: parsedUser,
    };
  } catch {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);

    return {
      token: null,
      user: null,
    };
  }
}

const initialSession = getStoredSession();

export function AuthProvider({ children }) {
  const [token, setToken] = useState(initialSession.token);
  const [user, setUser] = useState(initialSession.user);

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

    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));

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
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);

    setToken(null);
    setUser(null);
  }

  const setOAuthSession = useCallback((token, user) => {
    if (typeof token !== 'string' || token.trim() === '') {
      throw new Error('OAuth session requires a non-empty token');
    }

    if (!user || typeof user !== 'object' || Array.isArray(user)) {
      throw new Error('OAuth session requires a valid user object');
    }

    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));

    setToken(token);
    setUser(user);
  }, []);

  const updateUserProfile = useCallback((patch) => {
    setUser((current) => {
      if (!current) return current;

      const updatedUser = { ...current, ...patch };

      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));

      return updatedUser;
    });
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
      updateUserProfile,
    }),
    [user, token, setOAuthSession, updateUserProfile]
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
