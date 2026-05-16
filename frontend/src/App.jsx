import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store/appStore';
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

export default function App() {
  const theme = useAppStore(s => s.theme);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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
