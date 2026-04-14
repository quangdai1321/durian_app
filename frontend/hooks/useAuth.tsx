import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authApi } from "../services/api";

interface User {
  id: string;
  username: string;
  email: string;
  full_name?: string;
  role: string;
  province?: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  full_name?: string;
  phone?: string;
  province?: string;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem("user").then(raw => {
      if (raw) setUser(JSON.parse(raw));
    }).finally(() => setLoading(false));
  }, []);

  const login = async (username: string, password: string) => {
    const data: any = await authApi.login(username, password);
    setUser(data.user);
  };

  const register = async (data: RegisterData) => {
    await authApi.register(data);
    await login(data.username, data.password);
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const fresh: any = await authApi.me();
      setUser(fresh);
      await AsyncStorage.setItem("user", JSON.stringify(fresh));
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
