import { create } from "zustand";
import { persist } from "zustand/middleware";

interface User {
  id: string;
  nombre: string;
  email: string;
  rol: string;
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  user: User | null;
  tokens: Tokens | null;
  login: (user: User, tokens: Tokens) => void;
  setTokens: (tokens: Tokens) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      login: (user, tokens) => set({ user, tokens }),
      setTokens: (tokens) => set({ tokens }),
      logout: () => set({ user: null, tokens: null }),
    }),
    { name: "stocklisto-auth" },
  ),
);
