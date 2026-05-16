import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Shield, LayoutDashboard, Link2, Brain, ListTree, Map, FlaskConical, MessageSquareDiff, Settings, ChevronLeft, ChevronRight, RotateCcw, AlertTriangle } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { motion } from 'framer-motion';
import { resetWorkspace } from '../../utils/api';
import { clsx } from 'clsx';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/connect', icon: Link2, label: 'Connect & Setup' },
  { divider: true, label: 'IMPLEMENTATION' },
  { to: '/ai-officer', icon: Brain, label: 'AI Officer', requiresWs: true },
  { to: '/purposes', icon: ListTree, label: 'Purposes & Data', requiresWs: true },
  { to: '/scenarios', icon: Map, label: 'Scenario Studio', requiresWs: true },
  { to: '/test-harness', icon: FlaskConical, label: 'Test Harness', requiresWs: true },
  { to: '/updates', icon: MessageSquareDiff, label: 'Update Command', requiresWs: true },
  { divider: true, label: 'SYSTEM' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { sidebarOpen, setSidebar, workspace, clearWorkspace } = useAppStore();
  const navigate = useNavigate();
  const [confirmReset, setConfirmReset] = React.useState(false);

  const handleReset = async () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    try {
      await resetWorkspace();
      clearWorkspace();
      setConfirmReset(false);
      navigate('/connect');
    } catch (e) {
      setConfirmReset(false);
    }
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarOpen ? 256 : 64 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-full bg-surface-dark border-r border-white/5 flex flex-col z-30 overflow-hidden"
    >
      {/* Sidebar header */}
      <div className="h-14 flex items-center px-4 border-b border-white/5 flex-shrink-0">
        {sidebarOpen && (
          <div className="flex items-center gap-2 flex-1">
            <div className="w-7 h-7 bg-brand-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield size={14} className="text-white" />
            </div>
            <span className="font-heading font-bold text-sm tracking-tight">ZEROTRUST AI</span>
          </div>
        )}
        <button onClick={() => setSidebar(!sidebarOpen)} className="btn-ghost p-1.5 ml-auto">
          {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {navItems.map((item, i) => {
          if (item.divider) {
            return sidebarOpen ? (
              <div key={i} className="px-2 pt-4 pb-1.5">
                <span className="text-[10px] font-semibold text-slate-600 tracking-widest uppercase">{item.label}</span>
              </div>
            ) : <div key={i} className="my-2 mx-3 h-px bg-white/5" />;
          }

          const disabled = item.requiresWs && !workspace;

          return (
            <NavLink
              key={item.to}
              to={disabled ? '#' : item.to}
              onClick={e => disabled && e.preventDefault()}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 text-sm transition-all duration-150',
                isActive && !disabled
                  ? 'bg-brand-primary/15 text-brand-primary border border-brand-primary/20'
                  : disabled
                  ? 'text-slate-700 cursor-not-allowed'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              )}
              title={!sidebarOpen ? item.label : undefined}
            >
              <item.icon size={16} className="flex-shrink-0" />
              {sidebarOpen && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Reset Program */}
      {workspace && sidebarOpen && (
        <div className="p-3 border-t border-white/5">
          {confirmReset ? (
            <div className="p-2 rounded-lg bg-red-950/50 border border-red-900/50">
              <div className="flex items-center gap-1.5 text-red-400 text-xs mb-2">
                <AlertTriangle size={12} />
                <span>Confirm reset?</span>
              </div>
              <p className="text-[11px] text-slate-500 mb-2">Session will clear. OT artifacts are preserved.</p>
              <div className="flex gap-2">
                <button onClick={handleReset} className="flex-1 text-xs py-1 bg-red-900 hover:bg-red-800 text-red-200 rounded transition-colors">Reset</button>
                <button onClick={() => setConfirmReset(false)} className="flex-1 text-xs py-1 bg-white/5 hover:bg-white/10 text-slate-400 rounded transition-colors">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={handleReset} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-amber-400 hover:bg-amber-950/30 transition-all duration-150 border border-transparent hover:border-amber-900/30">
              <RotateCcw size={13} />
              <span>Reset Program</span>
            </button>
          )}
        </div>
      )}
    </motion.aside>
  );
}
