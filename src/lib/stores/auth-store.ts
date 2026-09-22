"use client";

import { create } from "zustand";
import type { User } from "@/lib/types";

const TOKEN_KEY = "mop-token";
const USER_KEY = "mop-user";
const THEME_KEY = "mop-theme";

interface AuthState {
  token: string | null;
  user: User | null;
  hydrated: boolean;
  login: (token: string, user: User, keepSignedIn: boolean) => void;
  logout: () => void;
  setUser: (user: User) => void;
  hydrate: () => void;
}

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key) ?? sessionStorage.getItem(key);
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrated: false,

  hydrate: () => {
    const token = readStorage(TOKEN_KEY);
    const rawUser = readStorage(USER_KEY);
    const user = rawUser ? (JSON.parse(rawUser) as User) : null;
    set({ token, user, hydrated: true });
  },

  login: (token, user, keepSignedIn) => {
    const store = keepSignedIn ? localStorage : sessionStorage;
    store.setItem(TOKEN_KEY, token);
    store.setItem(USER_KEY, JSON.stringify(user));
    set({ token, user, hydrated: true });
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    set({ token: null, user: null });
  },

  setUser: (user) => {
    set((state) => {
      const store = localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage;
      store.setItem(USER_KEY, JSON.stringify(user));
      return { ...state, user };
    });
  },
}));

export function isStaffRole(role: string | undefined): boolean {
  return role === "Super Admin" || role === "Manager" || role === "Viewer";
}

export { THEME_KEY };
