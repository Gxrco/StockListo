import { create } from "zustand";

interface AlertState {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
}

export const useAlertStore = create<AlertState>()((set) => ({
  unreadCount: 0,
  setUnreadCount: (count) => set({ unreadCount: count }),
}));
