import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { AuthSession, getCurrentSession, loginRequest, logoutRequest } from "../api/auth";

interface User {
  id: string;
  username: string;
  role: "ADMIN" | "OPERATOR";
  permissions?: string[];
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        const response = await getCurrentSession();
        if (!isMounted) {
          return;
        }
        const session = response.data as AuthSession;
        setUser({
          id: session.id,
          username: session.username,
          role: session.role,
          permissions: session.permissions ?? [],
        });
      } catch {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (username: string, password: string): Promise<User> => {
    const response = await loginRequest(username, password);

    const loggedUser = {
      id: response.data.id,
      username: response.data.username,
      role: response.data.role,
      permissions: response.data.permissions ?? [],
    } as User;

    setUser(loggedUser);

    return loggedUser;
  };

  const logout = async () => {
    try {
      await logoutRequest();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
};