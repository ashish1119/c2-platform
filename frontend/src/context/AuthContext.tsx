import { createContext, useContext, useState, ReactNode } from "react";
import axios from "axios";

interface User {
  id: string;
  username: string;
  role: "ADMIN" | "OPERATOR";
  token: string;
  permissions?: string[];
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("user");
    if (!saved) return null;
    try {
      return JSON.parse(saved) as User;
    } catch {
      localStorage.removeItem("user");
      return null;
    }
  });

  const login = async (username: string, password: string): Promise<User> => {
    const response = await axios.post("http://localhost:8000/auth/login", {
      username,
      password,
    });

    const loggedUser = {
      ...response.data,
      permissions: response.data.permissions ?? [],
    } as User;

    setUser(loggedUser);

    localStorage.setItem("token", loggedUser.token);
    localStorage.setItem("user", JSON.stringify(loggedUser));

    return loggedUser;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
};