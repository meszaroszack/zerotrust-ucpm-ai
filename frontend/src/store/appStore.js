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

      // Workspace — persisted so RequireWorkspace doesn't bounce on refresh.
      // The full workspace object from the server is cached here. On mount,
      // App.jsx re-fetches /api/workspace/active to sync; this cached value
      // prevents a flash-redirect to /connect while that fetch is in flight.
      workspace: null,

      // Planner session state — persisted so AI Officer page survives refresh.
      // Stored here (localStorage-backed) rather than sessionStorage so it
      // survives tab close. Cleared when workspace is reset or blueprint is approved.
      plannerState: null,

      // UI
      theme: 'dark',
      sidebarOpen: true,
      currentPage: 'dashboard',

      // Actions
      setAuth: (token, user) => set({ token, user, isAuthenticated: true }),
      clearAuth: () => set({
        token: null, user: null, isAuthenticated: false,
        otConnected: false, workspace: null, plannerState: null
      }),

      setOTConnection: (connected, credentials) => set({ otConnected: connected, otCredentials: credentials }),

      setWorkspace: (workspace) => set({ workspace }),
      updateWorkspace: (updates) => set(s => ({
        workspace: s.workspace ? { ...s.workspace, ...updates } : updates
      })),
      clearWorkspace: () => set({ workspace: null, otConnected: false, plannerState: null }),

      // Planner state — save/restore the active planner step and AI outputs
      setPlannerState: (plannerState) => set({ plannerState }),
      clearPlannerState: () => set({ plannerState: null }),

      toggleTheme: () => set(s => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setSidebar: (open) => set({ sidebarOpen: open }),
      setPage: (page) => set({ currentPage: page }),
    }),
    {
      name: 'zerotrust-app',
      partialize: (s) => ({
        token: s.token,
        user: s.user,
        isAuthenticated: s.isAuthenticated,
        theme: s.theme,
        otCredentials: s.otCredentials,
        // Persist workspace (summary only — avoids stale deep data)
        workspace: s.workspace ? {
          id: s.workspace.id,
          activeOrgId: s.workspace.activeOrgId,
          activeOrgName: s.workspace.activeOrgName,
          activeBrandName: s.workspace.activeBrandName,
          status: s.workspace.status,
          createdAt: s.workspace.createdAt,
          parentOrgName: s.workspace.parentOrgName,
        } : null,
        // Persist full planner state
        plannerState: s.plannerState,
      })
    }
  )
);
