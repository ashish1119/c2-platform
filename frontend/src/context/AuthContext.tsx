import React, { createContext, useContext, useState } from "react";
import api from "../api/axios";

interface AuthContextType {
  token: string | null;
  role: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>(null!);

export const AuthProvider = ({ children }: any) => {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [role, setRole] = useState(localStorage.getItem("role"));

  const login = async (username: string, password: string) => {
    const res = await api.post("/auth/login", { username, password });
    const accessToken = res.data.access_token;

    const payload = JSON.parse(atob(accessToken.split(".")[1]));
    setToken(accessToken);
    setRole(payload.role);

    localStorage.setItem("token", accessToken);
    localStorage.setItem("role", payload.role);
  };

  const logout = () => {
    localStorage.clear();
    setToken(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ token, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);