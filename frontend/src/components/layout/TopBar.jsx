import React from 'react';
import { Shield, Building2, Globe2, AlertCircle, CheckCircle2, RefreshCw, Sun, Moon, LogOut } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

function StatusPill({ connected }) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
      connected ? 'bg-green-950 border-green-800 text-green-400' : 'bg-red-950 border-red-900 text-red-400'
    }`}>
      {connected ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
      <span>{connected ? 'Connected' : 'Disconnected'}</span>
    </div>
  );
}

export default function TopBar() {
  const { workspace, otConnected, theme, toggleTheme, clearAuth, clearWorkspace } = useAppStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-14 border-b border-white/5 bg-surface-dark/80 backdrop-blur-xl flex items-center px-6 gap-4 flex-shrink-0 z-20"
    >
      {/* Logo */}
      <div className="flex items-center gap-2 mr-4">
        <Shield size={18} className="text-brand-primary" />
        <span className="font-heading font-bold text-sm tracking-tight text-white">ZEROTRUST<span className="text-brand-primary"> AI</span></span>
      </div>

      <div className="h-5 w-px bg-white/10" />

      {/* Org breadcrumb */}
      <div className="flex items-center gap-3 flex-1 text-xs">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Building2 size={12} />
          <span className="font-mono">Parent Org:</span>
          <span className="text-slate-400 font-medium">{workspace?.parentOrgName || 'Meszaros - Do Not Touch'}</span>
        </div>

        {workspace && (
          <>
            <span className="text-slate-700">/</span>
            <div className="flex items-center gap-1.5 text-slate-500">
              <Globe2 size={12} />
              <span className="font-mono">Active Org:</span>
              <span className="text-brand-accent font-medium">{workspace.activeOrgName || '—'}</span>
            </div>
            <span className="text-slate-700">/</span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-mono">Brand:</span>
              <span className="text-brand-gold font-semibold">{workspace.activeBrandName || '—'}</span>
            </div>
          </>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {workspace && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-brand-primary/10 border-brand-primary/30 text-brand-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
            <span>Session Active</span>
          </div>
        )}

        <StatusPill connected={otConnected} />

        <button onClick={toggleTheme} className="btn-ghost p-2">
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        <button onClick={handleLogout} className="btn-ghost p-2 text-slate-500 hover:text-red-400">
          <LogOut size={15} />
        </button>
      </div>
    </motion.header>
  );
}
