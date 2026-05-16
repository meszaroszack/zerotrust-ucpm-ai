import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Link2, Brain, Map, FlaskConical, RotateCcw, ArrowRight, Clock, Building2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { useQuery } from '@tanstack/react-query';
import { getWorkspaceHistory } from '../utils/api';
import { clsx } from 'clsx';

const stagger = { animate: { transition: { staggerChildren: 0.07 } } };
const item = { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

function QuickAction({ icon: Icon, title, desc, to, color = 'primary', disabled }) {
  const navigate = useNavigate();
  const colors = {
    primary: 'border-brand-primary/20 hover:border-brand-primary/50 hover:bg-brand-primary/5',
    accent: 'border-brand-accent/20 hover:border-brand-accent/50 hover:bg-brand-accent/5',
    gold: 'border-brand-gold/20 hover:border-brand-gold/50 hover:bg-brand-gold/5',
  };
  const iconColors = { primary: 'text-brand-primary', accent: 'text-brand-accent', gold: 'text-brand-gold' };

  return (
    <motion.button
      variants={item}
      onClick={() => !disabled && navigate(to)}
      disabled={disabled}
      className={clsx(
        'card-dark p-5 text-left transition-all duration-200 group border',
        disabled ? 'opacity-40 cursor-not-allowed border-white/5' : colors[color]
      )}
    >
      <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center mb-3 bg-white/5 group-hover:scale-110 transition-transform', !disabled && `group-hover:bg-${color === 'primary' ? 'brand-primary' : color === 'accent' ? 'brand-accent' : 'brand-gold'}/10`)}>
        <Icon size={18} className={iconColors[color]} />
      </div>
      <div className="font-heading font-semibold text-sm text-white mb-1">{title}</div>
      <div className="text-xs text-slate-500">{desc}</div>
      {!disabled && (
        <div className={clsx('flex items-center gap-1 mt-3 text-xs', iconColors[color])}>
          <span>Open</span><ArrowRight size={12} />
        </div>
      )}
    </motion.button>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <motion.div variants={item} className="card-dark p-4">
      <div className="text-xs text-slate-500 mb-1.5 uppercase tracking-wider font-medium">{label}</div>
      <div className={clsx('text-2xl font-heading font-bold', color || 'text-white')}>{value}</div>
      {sub && <div className="text-xs text-slate-600 mt-0.5">{sub}</div>}
    </motion.div>
  );
}

export default function DashboardPage() {
  const { workspace, otConnected, user } = useAppStore();
  const { data: historyData } = useQuery({ queryKey: ['ws-history'], queryFn: getWorkspaceHistory, enabled: true });
  const history = historyData?.data?.history || [];

  const artifactCount = workspace?.createdArtifacts?.length || 0;
  const scenarioCount = workspace?.scenarios?.length || 0;
  const changeCount = workspace?.changeHistory?.length || 0;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-brand-primary text-xs font-mono mb-2 uppercase tracking-widest">
          <Shield size={12} />
          <span>Command Center</span>
        </div>
        <h1 className="font-heading text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Welcome back, {user?.email?.split('@')[0] || 'Operator'}. This is your privacy implementation cockpit.</p>
      </div>

      {/* Active workspace banner */}
      {workspace ? (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 rounded-xl bg-gradient-to-r from-brand-primary/10 to-brand-accent/10 border border-brand-primary/20 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-brand-primary/20 flex items-center justify-center flex-shrink-0">
            <Building2 size={20} className="text-brand-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-heading font-semibold text-white text-sm">{workspace.activeBrandName}</span>
              <span className="badge bg-brand-primary/10 border border-brand-primary/30 text-brand-primary text-[10px]">Active Session</span>
            </div>
            <div className="text-xs text-slate-500 font-mono mt-0.5">Org: {workspace.activeOrgName} · Parent: {workspace.parentOrgName}</div>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <CheckCircle2 size={13} className="text-green-500" />
            <span className="text-slate-400">Workspace Active</span>
          </div>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6 p-4 rounded-xl bg-amber-950/20 border border-amber-900/30 flex items-center gap-3">
          <AlertCircle size={18} className="text-amber-500 flex-shrink-0" />
          <div>
            <div className="text-sm font-medium text-amber-400">No Active Workspace</div>
            <div className="text-xs text-slate-500 mt-0.5">Connect to OneTrust and create an org to start an implementation session.</div>
          </div>
          <button onClick={() => navigate('/connect')} className="btn-primary ml-auto text-xs py-1.5 px-3">
            Connect Now <ArrowRight size={13} />
          </button>
        </motion.div>
      )}

      {/* Stats */}
      <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard label="OT Artifacts" value={artifactCount} sub="Created in active org" color="text-brand-primary" />
        <StatCard label="Scenarios" value={scenarioCount} sub="Implementation scenarios" color="text-brand-accent" />
        <StatCard label="Changes" value={changeCount} sub="AI-driven updates" color="text-brand-gold" />
        <StatCard label="Prior Runs" value={history.length} sub="Historical sessions" color="text-slate-400" />
      </motion.div>

      {/* Quick actions */}
      <div className="mb-6">
        <div className="section-header">Quick Actions</div>
        <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickAction icon={Link2} title="Connect & Setup" desc="Enter OT credentials and create a new org" to="/connect" color="primary" />
          <QuickAction icon={Brain} title="AI Officer" desc="Upload requirements, generate implementation blueprint" to="/ai-officer" color="accent" disabled={!workspace} />
          <QuickAction icon={Map} title="Scenario Studio" desc="Build and manage geo/language scenario matrix" to="/scenarios" color="gold" disabled={!workspace} />
          <QuickAction icon={FlaskConical} title="Test Harness" desc="Simulate geo/language experiences with URL decoration" to="/test-harness" color="accent" disabled={!workspace} />
          <QuickAction icon={Brain} title="Update Command" desc="Request changes in plain English" to="/updates" color="primary" disabled={!workspace} />
        </motion.div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div>
          <div className="section-header">Prior Implementation Runs</div>
          <div className="space-y-2">
            {history.slice(0, 5).map((h, i) => (
              <div key={i} className="card-dark p-4 flex items-center gap-4">
                <RotateCcw size={14} className="text-slate-600 flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">{h.activeBrandName}</div>
                  <div className="text-xs text-slate-500 font-mono">{h.activeOrgName}</div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Clock size={11} />
                  <span>{new Date(h.resetAt || h.createdAt).toLocaleDateString()}</span>
                </div>
                <span className="badge bg-slate-800 border-slate-700 text-slate-500">Reset</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
