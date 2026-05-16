import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ListTree, Plus, Save, CheckCircle2, AlertTriangle, Info,
  Pencil, Loader2, Globe2, XCircle, RefreshCw, ExternalLink,
  AlertCircle, ArrowUpRight
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPurposes, getDataElements, createPurpose, createDataElement,
  updatePurpose, updateDataElement, reconcileOT, getOTStatus
} from '../utils/api';
import { useAppStore } from '../store/appStore';
import { clsx } from 'clsx';

const LEGAL_BASIS = ['consent', 'legitimate-interest', 'contract', 'legal-obligation', 'vital-interests', 'public-task'];
const DE_CATEGORIES = ['personal', 'sensitive', 'special-category', 'financial', 'biometric', 'location', 'behavioral', 'device', 'other'];

// ── Execution status badge ────────────────────────────────────────────────────
function ExecBadge({ obj }) {
  const s = obj.createStatus;
  if (s === 'created') return (
    <span className="inline-flex items-center gap-1 badge bg-green-950 border-green-800 text-green-400 text-[10px]">
      <CheckCircle2 size={10} />In OneTrust
      {obj.oneTrustId && <span className="font-mono opacity-60 ml-0.5">{obj.oneTrustId.slice(0, 8)}…</span>}
    </span>
  );
  if (s === 'pushing') return (
    <span className="inline-flex items-center gap-1 badge bg-blue-950 border-blue-800 text-blue-400 text-[10px]">
      <Loader2 size={10} className="animate-spin" />Pushing…
    </span>
  );
  if (s === 'failed') return (
    <span className="inline-flex items-center gap-1 badge bg-red-950 border-red-800 text-red-400 text-[10px]" title={obj.lastError}>
      <XCircle size={10} />Failed
    </span>
  );
  // local / undefined
  return (
    <span className="inline-flex items-center gap-1 badge bg-slate-800 border-slate-700 text-slate-400 text-[10px]">
      AI Draft
    </span>
  );
}

function ConfidenceBar({ score }) {
  const pct = Math.round((score || 0) * 100);
  const color = pct > 70 ? 'bg-brand-success' : pct > 40 ? 'bg-brand-gold' : 'bg-brand-error';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 font-mono w-8">{pct}%</span>
    </div>
  );
}

// ── Context bar: OT connection + simulated warning ───────────────────────────
function OTContextBar({ workspace }) {
  const { data } = useQuery({ queryKey: ['ot-status'], queryFn: getOTStatus, refetchInterval: 60000 });
  const status = data?.data;

  if (!workspace) return null;

  return (
    <div className={clsx(
      'flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs mb-5 border',
      workspace.simulated
        ? 'bg-amber-950/30 border-amber-800/40 text-amber-400'
        : status?.connected
        ? 'bg-green-950/20 border-green-800/30 text-green-400'
        : 'bg-red-950/20 border-red-800/30 text-red-400'
    )}>
      {workspace.simulated ? (
        <>
          <AlertTriangle size={13} className="flex-shrink-0" />
          <span><strong>Simulated Org</strong> — OneTrust writes are disabled. Objects are local only. Reconnect with a real org to push.</span>
        </>
      ) : status?.connected ? (
        <>
          <CheckCircle2 size={13} className="flex-shrink-0" />
          <span>Connected to <strong>{workspace.activeOrgName}</strong> ({workspace.activeOrgId}) · Brand: <strong>{workspace.activeBrandName}</strong></span>
        </>
      ) : (
        <>
          <AlertCircle size={13} className="flex-shrink-0" />
          <span>OneTrust connection unavailable: {status?.error || 'Check your credentials in Settings.'}</span>
        </>
      )}
    </div>
  );
}

// ── Purpose card ─────────────────────────────────────────────────────────────
function PurposeCard({ purpose, onUpdate, simulated }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...purpose });
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try { await onUpdate(purpose.id, form); setEditing(false); } finally { setSaving(false); }
  };

  const handlePush = async () => {
    setPushing(true);
    try { await onUpdate(purpose.id, { createInOT: true }); } finally { setPushing(false); }
  };

  const canPush = !simulated && purpose.createStatus !== 'created' && purpose.createStatus !== 'pushing';
  const hasFailed = purpose.createStatus === 'failed';

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-dark p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          {editing ? (
            <div className="space-y-3">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-dark font-medium" placeholder="Purpose name" />
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-dark text-xs resize-none h-20" placeholder="Description" />
              <select value={form.legalBasis} onChange={e => setForm(f => ({ ...f, legalBasis: e.target.value }))} className="input-dark text-xs">
                {LEGAL_BASIS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-heading font-semibold text-white text-sm">{purpose.name}</span>
                <ExecBadge obj={purpose} />
                {purpose.humanReviewRequired && <AlertTriangle size={12} className="text-amber-500" title="Human review required" />}
              </div>
              <p className="text-xs text-slate-500 mb-2">{purpose.description}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="geo-chip">{purpose.legalBasis}</span>
                {(purpose.regions || []).map(r => <span key={r} className="geo-chip">{r}</span>)}
              </div>
              {hasFailed && (
                <div className="flex items-start gap-1.5 mt-2 p-2 rounded-lg bg-red-950/30 border border-red-900/20 text-xs text-red-400">
                  <XCircle size={11} className="mt-0.5 flex-shrink-0" />
                  <span>{purpose.lastError}</span>
                </div>
              )}
            </>
          )}

          {purpose.confidenceScore !== undefined && !editing && (
            <div className="mt-2"><ConfidenceBar score={purpose.confidenceScore} /></div>
          )}
          {purpose.reasoning && !editing && (
            <div className="flex items-start gap-1.5 mt-2 text-xs text-slate-600">
              <Info size={11} className="mt-0.5 flex-shrink-0" /><span>{purpose.reasoning}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5 flex-shrink-0">
          {editing ? (
            <>
              <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-1.5 px-3">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              </button>
              <button onClick={() => setEditing(false)} className="btn-secondary text-xs py-1.5 px-3">Cancel</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="btn-ghost text-xs"><Pencil size={13} /></button>
              {canPush && (
                <button onClick={handlePush} disabled={pushing} className="btn-accent text-xs py-1 px-2.5 flex items-center gap-1">
                  {pushing ? <Loader2 size={12} className="animate-spin" /> : <ArrowUpRight size={12} />}
                  {hasFailed ? 'Retry' : 'Push to OT'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Reconcile tab ─────────────────────────────────────────────────────────────
function ReconcileTab() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await reconcileOT();
      setResult(r.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally { setLoading(false); }
  };

  const statusColor = { 'verified': 'text-green-400', 'local-only': 'text-slate-400', 'id-not-found-in-ot': 'text-red-400' };
  const statusLabel = { 'verified': 'In OneTrust ✓', 'local-only': 'Local only', 'id-not-found-in-ot': 'ID not found in OT' };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-slate-500 text-xs">Compare local workspace objects against what actually exists in OneTrust for the active org.</p>
        </div>
        <button onClick={run} disabled={loading} className="btn-primary text-xs">
          {loading ? <><Loader2 size={13} className="animate-spin" />Reconciling…</> : <><RefreshCw size={13} />Run Reconciliation</>}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-red-400 text-sm">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /><span>{error}</span>
        </div>
      )}

      {result?.simulated && (
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-400 text-sm">
          <AlertTriangle size={14} className="inline mr-2" />{result.message}
        </div>
      )}

      {result && !result.simulated && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Purposes', local: result.summary.localPurposes, verified: result.summary.verifiedPurposes, live: result.summary.livePurposesInOT },
              { label: 'Data Elements', local: result.summary.localDEs, verified: result.summary.verifiedDEs, live: result.summary.liveDEsInOT },
              { label: 'Collection Points', local: result.summary.localCPs, verified: result.summary.verifiedCPs, live: result.summary.liveCPsInOT },
            ].map(s => (
              <div key={s.label} className="card-dark p-3 text-center">
                <div className="text-xs text-slate-500 mb-2">{s.label}</div>
                <div className="text-sm font-mono">
                  <span className="text-white">{s.verified}</span>
                  <span className="text-slate-600">/{s.local} local · </span>
                  <span className="text-green-400">{s.live} live</span>
                </div>
              </div>
            ))}
          </div>

          {/* Per-object status */}
          {[
            { title: 'Purposes', items: result.local.purposes },
            { title: 'Data Elements', items: result.local.dataElements },
            { title: 'Collection Points', items: result.local.collectionPoints },
          ].map(group => group.items.length > 0 && (
            <div key={group.title} className="card-dark p-4">
              <div className="section-header mb-3">{group.title}</div>
              <div className="space-y-1.5">
                {group.items.map(item => (
                  <div key={item.localId} className="flex items-center gap-3 text-xs py-1.5 border-b border-white/5 last:border-0">
                    <span className="flex-1 text-white truncate">{item.name}</span>
                    <span className={clsx('font-medium flex-shrink-0', statusColor[item.reconcileStatus] || 'text-slate-500')}>
                      {statusLabel[item.reconcileStatus] || item.reconcileStatus}
                    </span>
                    {item.oneTrustId && (
                      <span className="font-mono text-slate-600 flex-shrink-0">{item.oneTrustId.slice(0, 8)}…</span>
                    )}
                    {item.lastError && (
                      <span className="text-red-400 truncate max-w-[180px]" title={item.lastError}>{item.lastError.slice(0, 40)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Unlinked in OT */}
          {(result.unlinkedInOT.purposes.length > 0 || result.unlinkedInOT.collectionPoints.length > 0) && (
            <div className="card-dark p-4 border-amber-900/20 border">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={13} className="text-amber-500" />
                <div className="section-header mb-0">In OneTrust but not linked locally</div>
              </div>
              <p className="text-xs text-slate-500 mb-3">These objects exist in your active org but aren't tracked in this workspace.</p>
              {result.unlinkedInOT.purposes.map(p => (
                <div key={p.id} className="text-xs py-1 text-slate-400 flex gap-2">
                  <span className="geo-chip">Purpose</span><span>{p.name}</span><span className="text-slate-600 font-mono">{p.id}</span>
                </div>
              ))}
              {result.unlinkedInOT.collectionPoints.map(cp => (
                <div key={cp.id} className="text-xs py-1 text-slate-400 flex gap-2">
                  <span className="geo-chip">CP</span><span>{cp.name}</span><span className="text-slate-600 font-mono">{cp.id}</span>
                </div>
              ))}
            </div>
          )}

          {result.reconcileErrors?.length > 0 && (
            <div className="p-3 rounded-lg bg-red-950/30 border border-red-900/20 text-xs text-red-400">
              Reconcile errors: {result.reconcileErrors.join('; ')}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PurposesPage() {
  const { workspace } = useAppStore();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('purposes');
  const [showAddPurpose, setShowAddPurpose] = useState(false);
  const [showAddElement, setShowAddElement] = useState(false);
  const [newPurpose, setNewPurpose] = useState({ name: '', description: '', legalBasis: 'consent' });
  const [newElement, setNewElement] = useState({ name: '', description: '', category: 'personal', sensitive: false });
  const [adding, setAdding] = useState(false);

  const { data: purposesData } = useQuery({ queryKey: ['purposes'], queryFn: getPurposes });
  const { data: elementsData } = useQuery({ queryKey: ['data-elements'], queryFn: getDataElements });

  const purposes = [...(purposesData?.data?.purposes || []), ...(workspace?.purposes || [])]
    .filter((p, i, a) => a.findIndex(x => x.id === p.id) === i);
  const elements = [...(elementsData?.data?.dataElements || []), ...(workspace?.dataElements || [])]
    .filter((e, i, a) => a.findIndex(x => x.id === e.id) === i);

  const handleUpdatePurpose = async (id, data) => {
    await updatePurpose(id, data);
    qc.invalidateQueries({ queryKey: ['purposes'] });
  };

  const handleAddPurpose = async () => {
    setAdding(true);
    try {
      await createPurpose({ ...newPurpose, createInOT: false });
      setNewPurpose({ name: '', description: '', legalBasis: 'consent' });
      setShowAddPurpose(false);
      qc.invalidateQueries({ queryKey: ['purposes'] });
    } finally { setAdding(false); }
  };

  const handleAddElement = async () => {
    setAdding(true);
    try {
      await createDataElement({ ...newElement, createInOT: false });
      setNewElement({ name: '', description: '', category: 'personal', sensitive: false });
      setShowAddElement(false);
      qc.invalidateQueries({ queryKey: ['data-elements'] });
    } finally { setAdding(false); }
  };

  const handlePushElement = async (el) => {
    await createDataElement({ ...el, createInOT: true });
    qc.invalidateQueries({ queryKey: ['data-elements'] });
  };

  const TABS = [
    { id: 'purposes', label: `Purposes (${purposes.length})` },
    { id: 'data-elements', label: `Data Elements (${elements.length})` },
    { id: 'reconcile', label: 'Reconcile' },
  ];

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-brand-primary text-xs font-mono mb-2 uppercase tracking-widest">
          <ListTree size={12} /><span>Privacy Objects</span>
        </div>
        <h1 className="font-heading text-3xl font-bold text-white">Purposes & Data Elements</h1>
        <p className="text-slate-500 text-sm mt-1">Review AI recommendations, edit, and push objects to OneTrust.</p>
      </div>

      <OTContextBar workspace={workspace} />

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/3 rounded-xl mb-5 border border-white/5 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={clsx('px-4 py-1.5 rounded-lg text-xs font-medium transition-all', {
              'bg-brand-primary text-white': t.id === activeTab,
              'text-slate-500 hover:text-white': t.id !== activeTab
            })}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Purposes */}
      {activeTab === 'purposes' && (
        <div className="space-y-3">
          {purposes.length === 0 && (
            <div className="card-dark p-8 text-center text-slate-500 text-sm">No purposes yet. Run the AI Officer to generate recommendations.</div>
          )}
          {purposes.map(p => (
            <PurposeCard key={p.id} purpose={p} onUpdate={handleUpdatePurpose} simulated={workspace?.simulated} />
          ))}
          {showAddPurpose ? (
            <div className="card-dark p-4 space-y-3">
              <div className="font-heading font-semibold text-white text-sm mb-2">Add Purpose</div>
              <input value={newPurpose.name} onChange={e => setNewPurpose(f => ({ ...f, name: e.target.value }))} className="input-dark" placeholder="Purpose name" />
              <textarea value={newPurpose.description} onChange={e => setNewPurpose(f => ({ ...f, description: e.target.value }))} className="input-dark resize-none h-16 text-xs" placeholder="Description" />
              <select value={newPurpose.legalBasis} onChange={e => setNewPurpose(f => ({ ...f, legalBasis: e.target.value }))} className="input-dark text-xs">
                {LEGAL_BASIS.map(b => <option key={b}>{b}</option>)}
              </select>
              <div className="flex gap-2">
                <button onClick={handleAddPurpose} disabled={adding || !newPurpose.name} className="btn-primary flex-1 justify-center text-xs">
                  {adding ? <Loader2 size={13} className="animate-spin" /> : <><Plus size={13} />Add Purpose</>}
                </button>
                <button onClick={() => setShowAddPurpose(false)} className="btn-secondary text-xs">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddPurpose(true)} className="btn-secondary w-full justify-center">
              <Plus size={15} />Add Purpose
            </button>
          )}
        </div>
      )}

      {/* Data Elements */}
      {activeTab === 'data-elements' && (
        <div className="space-y-3">
          {elements.length === 0 && (
            <div className="card-dark p-8 text-center text-slate-500 text-sm">No data elements yet. Run the AI Officer to generate recommendations.</div>
          )}
          {elements.map(el => (
            <motion.div key={el.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-dark p-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-heading font-semibold text-white text-sm">{el.name}</span>
                  <ExecBadge obj={el} />
                  <span className="geo-chip">{el.category}</span>
                  {el.sensitive && <span className="badge bg-red-950 border-red-900 text-red-400 text-[10px]">Sensitive</span>}
                </div>
                <p className="text-xs text-slate-500">{el.description}</p>
                {el.linkedPurposes?.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Globe2 size={11} className="text-slate-600" />
                    <span className="text-xs text-slate-600">{el.linkedPurposes.join(', ')}</span>
                  </div>
                )}
                {el.createStatus === 'failed' && el.lastError && (
                  <div className="flex items-start gap-1.5 mt-2 p-2 rounded-lg bg-red-950/30 border border-red-900/20 text-xs text-red-400">
                    <XCircle size={11} className="mt-0.5 flex-shrink-0" /><span>{el.lastError}</span>
                  </div>
                )}
              </div>
              {!workspace?.simulated && el.createStatus !== 'created' && el.createStatus !== 'pushing' && (
                <button onClick={() => handlePushElement(el)} className="btn-accent text-xs py-1.5 px-3 flex-shrink-0 flex items-center gap-1">
                  <ArrowUpRight size={12} />
                  {el.createStatus === 'failed' ? 'Retry' : 'Push to OT'}
                </button>
              )}
              {el.createStatus === 'created' && <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />}
            </motion.div>
          ))}

          {showAddElement ? (
            <div className="card-dark p-4 space-y-3">
              <div className="font-heading font-semibold text-white text-sm mb-2">Add Data Element</div>
              <input value={newElement.name} onChange={e => setNewElement(f => ({ ...f, name: e.target.value }))} className="input-dark" placeholder="Element name (e.g. Email Address)" />
              <textarea value={newElement.description} onChange={e => setNewElement(f => ({ ...f, description: e.target.value }))} className="input-dark resize-none h-16 text-xs" placeholder="Description" />
              <div className="flex gap-3">
                <select value={newElement.category} onChange={e => setNewElement(f => ({ ...f, category: e.target.value }))} className="input-dark text-xs flex-1">
                  {DE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
                <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                  <input type="checkbox" checked={newElement.sensitive} onChange={e => setNewElement(f => ({ ...f, sensitive: e.target.checked }))} className="w-3.5 h-3.5" />
                  Sensitive
                </label>
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddElement} disabled={adding || !newElement.name} className="btn-primary flex-1 justify-center text-xs">
                  {adding ? <Loader2 size={13} className="animate-spin" /> : <><Plus size={13} />Add Element</>}
                </button>
                <button onClick={() => setShowAddElement(false)} className="btn-secondary text-xs">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddElement(true)} className="btn-secondary w-full justify-center">
              <Plus size={15} />Add Data Element
            </button>
          )}
        </div>
      )}

      {/* Reconcile */}
      {activeTab === 'reconcile' && <ReconcileTab />}
    </div>
  );
}
