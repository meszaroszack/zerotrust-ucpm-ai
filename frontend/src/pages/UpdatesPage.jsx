import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquareDiff, Send, Sparkles, CheckCircle2, AlertTriangle, Info, Clock, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { aiProposeUpdate } from '../utils/api';
import { useAppStore } from '../store/appStore';
import { clsx } from 'clsx';

const EXAMPLE_REQUESTS = [
  'Change the consent model for UK to notice-only.',
  'Add a new marketing purpose for email campaigns.',
  'Create a French Canadian variant of the Canada scenario.',
  'Update the Germany form to collect job title.',
  'Add a footer preference center collection point.',
  'Create a new purpose for analytics and profiling.',
];

function DiffCard({ change }) {
  const changeColors = {
    add: 'text-green-400 bg-green-950/30 border-green-900/30',
    update: 'text-blue-400 bg-blue-950/30 border-blue-900/30',
    delete: 'text-red-400 bg-red-950/30 border-red-900/30',
  };

  return (
    <div className={clsx('p-3 rounded-lg border text-xs', changeColors[change.changeType] || changeColors.update)}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="font-mono font-medium uppercase">{change.changeType}</span>
        <span className="text-white font-medium">{change.name}</span>
        <span className="text-slate-500">({change.type})</span>
      </div>
      {change.currentValue !== undefined && (
        <div className="mb-1">
          <span className="text-slate-600">Before: </span>
          <span className="text-slate-400">{JSON.stringify(change.currentValue).slice(0, 80)}</span>
        </div>
      )}
      {change.proposedValue !== undefined && (
        <div>
          <span className="text-slate-600">After: </span>
          <span className="text-white">{JSON.stringify(change.proposedValue).slice(0, 80)}</span>
        </div>
      )}
    </div>
  );
}

function ChangeRequest({ entry }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="card-dark p-4">
      <div className="flex items-start gap-3">
        <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', {
          'bg-green-900/30': entry.status === 'approved',
          'bg-amber-900/30': entry.status === 'pending',
          'bg-red-900/30': entry.status === 'rejected',
        })}>
          {entry.status === 'approved' ? <CheckCircle2 size={14} className="text-green-400" /> :
           entry.status === 'rejected' ? <AlertTriangle size={14} className="text-red-400" /> :
           <Clock size={14} className="text-amber-400" />}
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-white mb-0.5">{entry.request}</div>
          <div className="text-xs text-slate-500 font-mono">{new Date(entry.timestamp).toLocaleString()}</div>
        </div>
        <button onClick={() => setExpanded(!expanded)} className="btn-ghost p-1">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && entry.result && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
              {entry.result.affectedObjects?.map((c, i) => <DiffCard key={i} change={c} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function UpdatesPage() {
  const { workspace } = useAppStore();
  const [request, setRequest] = useState('');
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState(null);
  const [history, setHistory] = useState([]);
  const [expanded, setExpanded] = useState(false);

  const changeHistory = workspace?.changeHistory || [];

  const handleSubmit = async () => {
    if (!request.trim()) return;
    setLoading(true);
    try {
      const r = await aiProposeUpdate({ request });
      setProposal({ request, result: r.data, status: 'pending', timestamp: new Date().toISOString() });
    } catch (e) {
      alert('AI proposal failed: ' + e.message);
    } finally { setLoading(false); }
  };

  const handleApprove = () => {
    if (!proposal) return;
    setHistory(h => [{ ...proposal, status: 'approved' }, ...h]);
    setProposal(null);
    setRequest('');
  };

  const handleReject = () => {
    if (!proposal) return;
    setHistory(h => [{ ...proposal, status: 'rejected' }, ...h]);
    setProposal(null);
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-brand-primary text-xs font-mono mb-2 uppercase tracking-widest">
          <MessageSquareDiff size={12} /><span>Update Command Center</span>
        </div>
        <h1 className="font-heading text-3xl font-bold text-white">Plain English Updates</h1>
        <p className="text-slate-500 text-sm mt-1">Describe what you want to change. AI interprets, shows you a diff, and you approve before anything touches OneTrust.</p>
      </div>

      {/* Input */}
      <div className="card-dark p-5 mb-6">
        <label className="label-dark">Update Request</label>
        <textarea
          value={request}
          onChange={e => setRequest(e.target.value)}
          className="input-dark resize-none h-28 mb-3"
          placeholder={'Describe what you want to change...\nExample: "Change the consent model for UK to opt-out and add a new marketing purpose."'}
        />

        {/* Examples */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {EXAMPLE_REQUESTS.map(ex => (
            <button key={ex} onClick={() => setRequest(ex)}
              className="px-2.5 py-1 rounded-lg text-[11px] bg-white/3 border border-white/8 text-slate-500 hover:text-white hover:border-white/15 transition-all">
              {ex}
            </button>
          ))}
        </div>

        <button onClick={handleSubmit} disabled={loading || !request.trim()} className="btn-primary w-full justify-center">
          {loading ? <><Loader2 size={15} className="animate-spin" />AI is analyzing...</> : <><Sparkles size={15} />Propose Changes</>}
        </button>
      </div>

      {/* Proposal */}
      <AnimatePresence>
        {proposal && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="card-dark p-5 mb-6 border border-brand-accent/20"
          >
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={15} className="text-brand-accent" />
              <span className="font-heading font-semibold text-white text-sm">Proposed Changes</span>
              <span className="badge bg-amber-950 border-amber-900 text-amber-400 text-[10px] ml-auto">Awaiting Approval</span>
            </div>

            {proposal.result?.summary && (
              <p className="text-sm text-slate-400 mb-4">{proposal.result.summary}</p>
            )}

            {proposal.result?.diff && (
              <div className="p-3 rounded-lg bg-white/3 border border-white/6 text-xs text-slate-400 font-mono mb-4">
                {proposal.result.diff}
              </div>
            )}

            {proposal.result?.affectedObjects?.length > 0 && (
              <div className="space-y-2 mb-4">
                <div className="section-header">Affected Objects</div>
                {proposal.result.affectedObjects.map((c, i) => <DiffCard key={i} change={c} />)}
              </div>
            )}

            {proposal.result?.warnings?.length > 0 && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-950/30 border border-amber-900/20 text-xs text-amber-400 mb-4">
                <AlertTriangle size={12} />
                <span>{proposal.result.warnings[0]}</span>
              </div>
            )}

            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-950/30 border border-blue-900/20 text-xs text-blue-400 mb-4">
              <Info size={12} />
              <span>This is a regulatory-informed implementation recommendation. Human review required.</span>
            </div>

            <div className="flex gap-3">
              <button onClick={handleReject} className="btn-secondary flex-1 justify-center">Reject</button>
              <button onClick={handleApprove} className="btn-accent flex-1 justify-center">
                <CheckCircle2 size={15} />Approve & Apply
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History */}
      {(history.length > 0 || changeHistory.length > 0) && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="section-header mb-0">Change History</div>
            <button onClick={() => setExpanded(!expanded)} className="btn-ghost text-xs">
              {expanded ? 'Collapse' : 'Expand All'}
            </button>
          </div>
          <div className="space-y-2">
            {history.map((entry, i) => <ChangeRequest key={`local-${i}`} entry={entry} />)}
            {changeHistory.slice(0, 10).map((c, i) => (
              <div key={`ws-${i}`} className="card-dark p-3 flex items-center gap-3">
                <CheckCircle2 size={13} className="text-green-400 flex-shrink-0" />
                <div className="flex-1 text-xs text-slate-400">
                  <span className="font-mono">{c.action}</span> · <span className="text-white">{c.objectType}</span>: {c.name}
                </div>
                <span className="text-xs text-slate-600 font-mono">{new Date(c.timestamp).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
