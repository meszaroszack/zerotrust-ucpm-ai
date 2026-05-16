import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ListTree, Plus, Save, CheckCircle2, AlertTriangle, Info, Pencil, Loader2, Globe2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPurposes, getDataElements, createPurpose, createDataElement, updatePurpose, updateDataElement } from '../utils/api';
import { useAppStore } from '../store/appStore';
import { clsx } from 'clsx';

const LEGAL_BASIS = ['consent', 'legitimate-interest', 'contract', 'legal-obligation', 'vital-interests', 'public-task'];
const DE_CATEGORIES = ['personal', 'sensitive', 'special-category', 'financial', 'biometric', 'location', 'behavioral', 'device', 'other'];

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

function PurposeCard({ purpose, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...purpose });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try { await onUpdate(purpose.id, form); setEditing(false); } finally { setSaving(false); }
  };

  const statusColor = {
    created: 'bg-green-950 border-green-800 text-green-400',
    draft: 'bg-slate-800 border-slate-700 text-slate-400',
    updated: 'bg-blue-950 border-blue-800 text-blue-400',
  };

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
              <div className="flex items-center gap-2 mb-1">
                <span className="font-heading font-semibold text-white text-sm">{purpose.name}</span>
                <span className={clsx('badge border text-[10px]', statusColor[purpose.status] || statusColor.draft)}>{purpose.status}</span>
                {purpose.humanReviewRequired && <AlertTriangle size={12} className="text-amber-500" title="Human review required" />}
              </div>
              <p className="text-xs text-slate-500 mb-2">{purpose.description}</p>
              <div className="flex items-center gap-3">
                <span className="geo-chip">{purpose.legalBasis}</span>
                {purpose.regions?.map(r => <span key={r} className="geo-chip">{r}</span>)}
              </div>
            </>
          )}

          {purpose.confidenceScore !== undefined && !editing && (
            <div className="mt-2">
              <ConfidenceBar score={purpose.confidenceScore} />
            </div>
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
              {purpose.status === 'draft' && (
                <button onClick={() => onUpdate(purpose.id, { createInOT: true })} className="btn-accent text-xs py-1 px-2.5">Push to OT</button>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

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

  const purposes = [...(purposesData?.data?.purposes || []), ...(workspace?.purposes || [])].filter((p, i, a) => a.findIndex(x => x.id === p.id) === i);
  const elements = [...(elementsData?.data?.dataElements || []), ...(workspace?.dataElements || [])].filter((e, i, a) => a.findIndex(x => x.id === e.id) === i);

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

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-brand-primary text-xs font-mono mb-2 uppercase tracking-widest">
          <ListTree size={12} /><span>Privacy Objects</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-3xl font-bold text-white">Purposes & Data Elements</h1>
            <p className="text-slate-500 text-sm mt-1">Review AI recommendations, edit, and push objects to OneTrust.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/3 rounded-xl mb-5 border border-white/5 w-fit">
        {['purposes', 'data-elements'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={clsx('px-4 py-1.5 rounded-lg text-xs font-medium transition-all capitalize', {
              'bg-brand-primary text-white': t === activeTab,
              'text-slate-500 hover:text-white': t !== activeTab
            })}>
            {t.replace('-', ' ')} ({t === 'purposes' ? purposes.length : elements.length})
          </button>
        ))}
      </div>

      {activeTab === 'purposes' && (
        <div className="space-y-3">
          {purposes.length === 0 && (
            <div className="card-dark p-8 text-center text-slate-500 text-sm">No purposes yet. Run the AI Officer to generate recommendations.</div>
          )}
          {purposes.map(p => <PurposeCard key={p.id} purpose={p} onUpdate={handleUpdatePurpose} />)}

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

      {activeTab === 'data-elements' && (
        <div className="space-y-3">
          {elements.length === 0 && (
            <div className="card-dark p-8 text-center text-slate-500 text-sm">No data elements yet. Run the AI Officer to generate recommendations.</div>
          )}
          {elements.map(el => (
            <motion.div key={el.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-dark p-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-heading font-semibold text-white text-sm">{el.name}</span>
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
              </div>
              {el.status === 'draft' && (
                <button onClick={async () => { await createDataElement({ ...el, createInOT: true }); qc.invalidateQueries({ queryKey: ['data-elements'] }); }} className="btn-accent text-xs py-1.5 px-3">Push to OT</button>
              )}
              {el.status === 'created' && <CheckCircle2 size={16} className="text-green-500" />}
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
    </div>
  );
}
