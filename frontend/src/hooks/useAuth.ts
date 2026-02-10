import { useState, useCallback } from "react";
import type { User, LoginResponse } from "../api/types";
import { api } from "../api/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<LoginResponse>("/auth/login", { email, password });
    localStorage.setItem("token", res.access_token);
    localStorage.setItem("user", JSON.stringify(res.user));
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }, []);

  return { user, login, logout, isAdmin: user?.role === "admin" };
}
