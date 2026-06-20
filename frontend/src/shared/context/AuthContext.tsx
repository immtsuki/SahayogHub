import { createContext, useContext, useState } from 'react';

interface AuthUser {
  name: string;
  avatar: string;
  email?: string;
  phone?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (name: string, avatar: string, email?: string, phone?: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  function login(name: string, avatar: string, email?: string, phone?: string) {
    setUser({ name, avatar, email, phone });
  }

  function logout() {
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
