import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, setToken, type AuthUser, type Standing } from "../lib/api";

type AuthState = {
  user: AuthUser | null;
  standing: Standing | null;
  loading: boolean;
  login: (login: string, password: string, turnstileToken?: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [standing, setStanding] = useState<Standing | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.me();
      setUser(data.user);
      setStanding(data.standing);
    } catch {
      setUser(null);
      setStanding(null);
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (loginId: string, password: string, turnstileToken?: string) => {
    const data = await api.login(loginId, password, turnstileToken);
    setToken(data.token);
    setUser(data.user);
    try {
      const me = await api.me();
      setUser(me.user);
      setStanding(me.standing);
    } catch {
      // Keep session from login response if /me fails (e.g. sheet lookup timeout)
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setStanding(null);
  };

  return (
    <AuthContext.Provider value={{ user, standing, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
