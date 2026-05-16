import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAppStore = create(
  persist(
    (set, get) => ({
      // Auth
      token: null,
      user: null,
      isAuthenticated: false,

      // OneTrust connection
      otConnected: false,
      otCredentials: null,

      // Workspace
      workspace: null,

      // UI
      theme: 'dark',
      sidebarOpen: true,
      currentPage: 'dashboard',

      // Actions
      setAuth: (token, user) => set({ token, user, isAuthenticated: true }),
      clearAuth: () => set({ token: null, user: null, isAuthenticated: false, otConnected: false, workspace: null }),
      
      setOTConnection: (connected, credentials) => set({ otConnected: connected, otCredentials: credentials }),
      
      setWorkspace: (workspace) => set({ workspace }),
      updateWorkspace: (updates) => set(s => ({ workspace: s.workspace ? { ...s.workspace, ...updates } : updates })),
      clearWorkspace: () => set({ workspace: null, otConnected: false }),

      toggleTheme: () => set(s => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setSidebar: (open) => set({ sidebarOpen: open }),
      setPage: (page) => set({ currentPage: page }),
    }),
    {
      name: 'zerotrust-app',
      partialize: (s) => ({ token: s.token, user: s.user, isAuthenticated: s.isAuthenticated, theme: s.theme, otCredentials: s.otCredentials })
    }
  )
);
