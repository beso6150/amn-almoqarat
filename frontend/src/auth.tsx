import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, getToken, setToken } from "./api";

export type Role = "admin" | "supervisor" | "guard";
export type UserStatus = "pending" | "approved" | "rejected";

type User = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  status: UserStatus;
} | null;

type LoginResult = { pending?: boolean; message?: string };

type Ctx = {
  user: User;
  loading: boolean;
  isAdmin: boolean;
  login: (e: string, p: string) => Promise<void>;
  register: (e: string, p: string, n: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | undefined>(undefined);

export const useAuth = () => {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const u = await api.me();
      setUser(u);
    } catch {
      await setToken(null);
      setUser(null);
    }
  };

  useEffect(() => {
    (async () => {
      const t = await getToken();
      if (t) await refresh();
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    await setToken(res.access_token);
    setUser(res.user);
  };

  const register = async (email: string, password: string, name: string) => {
    const res = await api.register(email, password, name);
    if (res.pending) {
      return { pending: true, message: res.message };
    }
    await setToken(res.access_token);
    setUser(res.user);
    return { pending: false };
  };

  const logout = async () => {
    await setToken(null);
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, isAdmin: user?.role === "admin", login, register, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
};
