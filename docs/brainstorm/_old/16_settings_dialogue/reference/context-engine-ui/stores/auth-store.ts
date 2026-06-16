"use client";

import { useSyncExternalStore } from "react";
import { hasAccessToken, setAccessToken } from "@/lib/api/client";
import { authApi } from "@/lib/api/auth";
import type { CurrentUser } from "@/types/user";

type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

type AuthState = {
  user: CurrentUser | null;
  status: AuthStatus;
  bootstrap: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const listeners = new Set<() => void>();

let state: AuthState = {
  user: null,
  status: "idle",
  bootstrap,
  login,
  logout,
  refresh,
};

function setState(patch: Partial<AuthState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

async function bootstrap() {
  if (state.status === "loading" || state.status === "authenticated") return;
  if (!hasAccessToken()) {
    setState({ user: null, status: "unauthenticated" });
    return;
  }
  setState({ status: "loading" });
  try {
    const user = await authApi.me();
    setState({ user, status: "authenticated" });
  } catch (error) {
    void error;
    setAccessToken(null);
    setState({ user: null, status: "unauthenticated" });
  }
}

async function login(username: string, password: string) {
  setState({ status: "loading" });
  try {
    const token = await authApi.login({ username, password });
    setAccessToken(token.access_token);
    const user = await authApi.me();
    setState({ user, status: "authenticated" });
  } catch (error) {
    setAccessToken(null);
    setState({ user: null, status: "unauthenticated" });
    throw error;
  }
}

async function logout() {
  try {
    await authApi.logout();
  } finally {
    setAccessToken(null);
    setState({ user: null, status: "unauthenticated" });
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.replace("/login");
    }
  }
}

async function refresh() {
  if (!hasAccessToken()) {
    setState({ user: null, status: "unauthenticated" });
    return;
  }
  const user = await authApi.me();
  setState({ user, status: "authenticated" });
}

export function useAuthStore<T = AuthState>(selector: (state: AuthState) => T = (value) => value as T): T {
  return useSyncExternalStore(subscribe, () => selector(getSnapshot()), () => selector(getSnapshot()));
}

export const selectIsAdmin = (value: Pick<AuthState, "user">) => value.user?.role === "admin";
export const selectCanWrite = (value: Pick<AuthState, "user">) => value.user?.role === "admin";
