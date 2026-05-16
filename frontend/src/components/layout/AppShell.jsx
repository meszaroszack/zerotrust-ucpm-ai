import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import { getWorkspace } from '../../utils/api';

export default function AppShell() {
  const { workspace, setWorkspace, sidebarOpen } = useAppStore();

  useEffect(() => {
    // Sync workspace from server on mount
    getWorkspace().then(r => {
      if (r.data.active && r.data.workspace) {
        setWorkspace(r.data.workspace);
      }
    }).catch(() => {});
  }, []);

  return (
    <div className="flex h-screen bg-bg-dark overflow-hidden">
      <Sidebar />
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <TopBar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
