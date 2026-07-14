import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, getToken, setToken } from "./api";

export type Role = "admin" | "supervisor" | "guard";
export type UserStatus = "pending" | "approved" | "rejected";

type User = {
  id: string;
  phone: string;
  full_name: string;
  role: Role;
  status: UserStatus;
  must_change_password?: boolean;
} | null;

type Ctx = {
  user: User;
  loading: boolean;
  isAdmin: boolean;
  adminExists: boolean | null;
  login: (phone: string, password: string) => Promise<{ mustChange?: boolean }>;
  register: (full_name: string, phone: string) => Promise<{ pending: boolean; message?: string }>;
  adminSetup: (full_name: string, phone: string, password: string) => Promise<void>;
  changePassword: (new_password: string) => Promise<void>;
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
  const [adminExists, setAdminExists] = useState<boolean | null>(null);

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
      try {
        const s = await api.authStatus();
        setAdminExists(!!s.admin_exists);
      } catch {}
      const t = await getToken();
      if (t) await refresh();
      setLoading(false);
    })();
  }, []);

  const login = async (phone: string, password: string) => {
    const res = await api.login(phone, password);
    await setToken(res.access_token);
    setUser(res.user);
    setAdminExists(true);
    return { mustChange: !!res.user.must_change_password };
  };

  const register = async (full_name: string, phone: string) => {
    const res = await api.register(full_name, phone);
    return { pending: !!res.pending, message: res.message };
  };

  const adminSetup = async (full_name: string, phone: string, password: string) => {
    const res = await api.adminSetup(full_name, phone, password);
    await setToken(res.access_token);
    setUser(res.user);
    setAdminExists(true);
  };

  const changePassword = async (new_password: string) => {
    await api.changePassword(new_password);
    await refresh();
  };

  const logout = async () => {
    await setToken(null);
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, isAdmin: user?.role === "admin", adminExists, login, register, adminSetup, changePassword, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
};
