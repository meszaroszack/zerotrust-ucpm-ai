import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAppStore } from './store/appStore';
import { getSetupStatus } from './utils/api';
import SetupPage from './pages/SetupPage';
import LoginPage from './pages/LoginPage';
import AppShell from './components/layout/AppShell';
import DashboardPage from './pages/DashboardPage';
import ConnectionWizardPage from './pages/ConnectionWizardPage';
import AIImplementationPage from './pages/AIImplementationPage';
import PurposesPage from './pages/PurposesPage';
import ScenarioStudioPage from './pages/ScenarioStudioPage';
import TestHarnessPage from './pages/TestHarnessPage';
import UpdatesPage from './pages/UpdatesPage';
import SettingsPage from './pages/SettingsPage';

function RequireAuth({ children }) {
  const isAuthenticated = useAppStore(s => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function RequireWorkspace({ children }) {
  const workspace = useAppStore(s => s.workspace);
  const isAuthenticated = useAppStore(s => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!workspace) return <Navigate to="/connect" replace />;
  return children;
}

function Spinner() {
  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <svg className="animate-spin w-8 h-8 text-brand-primary" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
        </svg>
        <span className="text-slate-500 text-sm">Loading...</span>
      </div>
    </div>
  );
}

export default function App() {
  const theme = useAppStore(s => s.theme);
  // 'loading' | 'setup' | 'ready'
  const [appState, setAppState] = useState('loading');

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  useEffect(() => {
    getSetupStatus()
      .then(r => {
        const s = r.data;
        // Go to setup if: explicitly first run, OR missing admin account, OR missing AI key
        const needsSetup = s.isFirstRun || !s.hasAdminAccount || !s.hasAIKey;
        setAppState(needsSetup ? 'setup' : 'ready');
      })
      .catch(() => {
        // Can't reach backend yet — show setup so they can configure it
        // (better than a broken login screen)
        setAppState('setup');
      });
  }, []);

  if (appState === 'loading') return <Spinner />;

  if (appState === 'setup') {
    return (
      <SetupPage onComplete={() => {
        setAppState('ready');
        window.location.href = '/login';
      }} />
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={
        <SetupPage onComplete={() => { window.location.href = '/login'; }} />
      } />
      <Route path="/" element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="connect" element={<ConnectionWizardPage />} />
        <Route path="ai-officer" element={<RequireWorkspace><AIImplementationPage /></RequireWorkspace>} />
        <Route path="purposes" element={<RequireWorkspace><PurposesPage /></RequireWorkspace>} />
        <Route path="scenarios" element={<RequireWorkspace><ScenarioStudioPage /></RequireWorkspace>} />
        <Route path="test-harness" element={<RequireWorkspace><TestHarnessPage /></RequireWorkspace>} />
        <Route path="updates" element={<RequireWorkspace><UpdatesPage /></RequireWorkspace>} />
        <Route path="settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
