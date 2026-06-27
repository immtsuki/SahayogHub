import { createContext, useContext, useEffect, useState } from 'react';
import { fetchCurrentUser, loginUser, logoutUser, registerUser } from '../api/auth';
import type { ApiUser } from '../api/auth';
import { getAccessToken, setAccessToken } from '../api/client';

interface AuthUser {
  id?: string | number;
  name: string;
  avatar: string;
  email?: string;
  phone?: string;
  district?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { name: string; email: string; password: string; phone?: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const USER_STORAGE_KEY = 'sahayog-auth-user';

function toAuthUser(user: ApiUser): AuthUser {
  return {
    id: user.id,
    name: user.full_name || user.email.split('@')[0],
    avatar: user.profile_photo || `https://i.pravatar.cc/36?u=${user.email}`,
    email: user.email,
    phone: user.phone || undefined,
    district: user.district,
  };
}

function loadStoredUser() {
  try {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    return stored ? JSON.parse(stored) as AuthUser : null;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadStoredUser);
  const [loading, setLoading] = useState(true);

  function persist(nextUser: AuthUser | null) {
    setUser(nextUser);
    if (nextUser) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
    else localStorage.removeItem(USER_STORAGE_KEY);
  }

  useEffect(() => {
    let active = true;

    async function hydrate() {
      if (!getAccessToken()) {
        if (active) setLoading(false);
        return;
      }
      try {
        const profile = await fetchCurrentUser();
        if (active) persist(toAuthUser(profile));
      } catch {
        setAccessToken(null);
        if (active) persist(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    hydrate();
    return () => {
      active = false;
    };
  }, []);

  async function login(email: string, password: string) {
    const profile = await loginUser(email, password);
    persist(toAuthUser(profile));
  }

  async function register(payload: { name: string; email: string; password: string; phone?: string }) {
    const profile = await registerUser({
      email: payload.email,
      fullName: payload.name,
      phone: payload.phone,
      password: payload.password,
      password2: payload.password,
    });
    persist(toAuthUser(profile));
  }

  async function logout() {
    try {
      await logoutUser();
    } finally {
      persist(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}
