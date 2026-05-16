import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Map, Globe2, Languages, Shield, Layers, Plus, CheckCircle2, AlertTriangle, Loader2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { createCollectionPoint, aiGenerateScenarios } from '../utils/api';
import { clsx } from 'clsx';

const POSTURE_CONFIG = {
  'opt-in': { label: 'Opt-In', cls: 'posture-opt-in', badge: 'Strict Consent' },
  'opt-out': { label: 'Opt-Out', cls: 'posture-opt-out', badge: 'Default Active' },
  'notice-only': { label: 'Notice Only', cls: 'posture-notice', badge: 'Informational' },
  'legitimate-interest': { label: 'Legit Interest', cls: 'posture-legit', badge: 'No Banner' },
};

const FLAG_MAP = {
  DE: '🇩🇪', GB: '🇬🇧', US: '🇺🇸', CA: '🇨🇦', FR: '🇫🇷', AU: '🇦🇺', NL: '🇳🇱', global: '🌍'
};

function ScenarioCard({ scenario, onCreateCP }) {
  const [expanded, setExpanded] = useState(false);
  const [creating, setCreating] = useState(false);
  const posture = POSTURE_CONFIG[scenario.consentPosture] || POSTURE_CONFIG['notice-only'];
  const flag = FLAG_MAP[scenario.countryCode] || FLAG_MAP['global'];

  const handleCreate = async () => {
    setCreating(true);
    try {
      await onCreateCP(scenario);
    } finally { setCreating(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx('card-dark overflow-hidden border transition-all duration-200', {
        'border-green-800/50': scenario.status === 'created',
        'border-white/5 hover:border-white/10': scenario.status !== 'created'
      })}
    >
      {/* Card header */}
      <div className="p-4 flex items-start gap-3">
        <div className="text-2xl">{flag}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-heading font-semibold text-white text-sm">{scenario.name}</span>
            {scenario.status === 'created' && <CheckCircle2 size={14} className="text-green-400" />}
            {scenario.priority === 'high' && <span className="badge bg-brand-primary/10 border-brand-primary/20 text-brand-primary text-[10px]">Priority</span>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="geo-chip">{scenario.countryCode}{scenario.stateCode ? `-${scenario.stateCode}` : ''}</span>
            <span className="geo-chip">{scenario.languageCode || scenario.language}</span>
            <span className={clsx('badge border text-[10px]', posture.cls)}>{posture.label}</span>
            <span className="text-xs text-slate-600">· {scenario.cpType || 'standard'} CP</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {scenario.status !== 'created' && (
            <button onClick={handleCreate} disabled={creating} className="btn-accent text-xs py-1.5 px-3">
              {creating ? <Loader2 size={13} className="animate-spin" /> : <>Create CP</>}
            </button>
          )}
          <button onClick={() => setExpanded(!expanded)} className="btn-ghost p-1.5">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-white/5">
            <div className="p-4 grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="section-header mb-2">Purposes</div>
                <div className="flex flex-wrap gap-1">
                  {(scenario.purposes || []).map(p => (
                    <span key={p} className="px-2 py-0.5 rounded bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-[11px]">{p}</span>
                  ))}
                </div>
              </div>
              <div>
                <div className="section-header mb-2">Data Elements</div>
                <div className="flex flex-wrap gap-1">
                  {(scenario.dataElements || []).map(d => (
                    <span key={d} className="px-2 py-0.5 rounded bg-brand-accent/10 border border-brand-accent/20 text-brand-accent text-[11px]">{d}</span>
                  ))}
                </div>
              </div>
              <div className="col-span-2">
                <div className="section-header mb-2">AI Rationale</div>
                <p className="text-slate-500">{scenario.rationale}</p>
              </div>
              {scenario.testUrl && (
                <div className="col-span-2">
                  <div className="section-header mb-2">Test URL</div>
                  <code className="text-brand-accent text-[11px] bg-brand-accent/5 px-2 py-1 rounded">{scenario.testUrl}</code>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ScenarioStudioPage() {
  const { workspace, updateWorkspace } = useAppStore();
  const [generating, setGenerating] = useState(false);
  const [scenarios, setScenarios] = useState(workspace?.scenarios || []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const ctx = {
        brandName: workspace?.activeBrandName,
        purposes: workspace?.purposes,
        dataElements: workspace?.dataElements,
      };
      const r = await aiGenerateScenarios({ context: ctx });
      const newScenarios = r.data?.scenarios || [];
      setScenarios(newScenarios);
      updateWorkspace({ scenarios: newScenarios });
    } catch (e) {
      alert('Failed to generate scenarios: ' + e.message);
    } finally { setGenerating(false); }
  };

  const handleCreateCP = async (scenario) => {
    try {
      await createCollectionPoint({
        name: `${scenario.name} - Collection Point`,
        label: scenario.name,
        description: `Auto-generated CP for scenario: ${scenario.name}`,
        cpType: scenario.cpType || 'standard',
        locale: scenario.languageCode,
        region: scenario.region,
        scenarioId: scenario.id,
        createInOT: true,
      });
      setScenarios(s => s.map(sc => sc.id === scenario.id ? { ...sc, status: 'created' } : sc));
    } catch (e) {
      alert('CP creation failed: ' + e.message);
    }
  };

  const groupedByRegion = scenarios.reduce((acc, s) => {
    const key = s.region || s.country || 'Global';
    acc[key] = [...(acc[key] || []), s];
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-brand-gold text-xs font-mono mb-2 uppercase tracking-widest">
          <Map size={12} /><span>Scenario Studio</span>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold text-white">Scenario Matrix</h1>
            <p className="text-slate-500 text-sm mt-1">Each scenario maps to regions, languages, consent postures, and OneTrust collection points.</p>
          </div>
          <button onClick={handleGenerate} disabled={generating} className="btn-primary">
            {generating ? <><Loader2 size={15} className="animate-spin" />Generating...</> : <><Map size={15} />Generate Scenarios</>}
          </button>
        </div>
      </div>

      {scenarios.length === 0 ? (
        <div className="card-dark p-12 text-center">
          <Globe2 size={36} className="mx-auto text-slate-700 mb-4" />
          <div className="font-heading font-semibold text-white mb-2">No Scenarios Yet</div>
          <p className="text-slate-500 text-sm mb-6">Generate scenarios based on your program context, or add them manually.</p>
          <button onClick={handleGenerate} disabled={generating} className="btn-primary mx-auto">
            {generating ? <><Loader2 size={15} className="animate-spin" />Generating...</> : <><Map size={15} />Generate Scenarios</>}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Scenarios', val: scenarios.length, color: 'text-white' },
              { label: 'Created', val: scenarios.filter(s => s.status === 'created').length, color: 'text-green-400' },
              { label: 'Opt-In Required', val: scenarios.filter(s => s.consentPosture === 'opt-in').length, color: 'text-brand-primary' },
              { label: 'Pending', val: scenarios.filter(s => s.status !== 'created').length, color: 'text-amber-400' },
            ].map(s => (
              <div key={s.label} className="card-dark p-3 text-center">
                <div className={clsx('text-xl font-heading font-bold', s.color)}>{s.val}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Scenarios by region */}
          {Object.entries(groupedByRegion).map(([region, regionScenarios]) => (
            <div key={region}>
              <div className="flex items-center gap-2 mb-3">
                <Globe2 size={14} className="text-slate-500" />
                <span className="section-header mb-0">{region}</span>
                <span className="text-xs text-slate-600">({regionScenarios.length})</span>
              </div>
              <div className="space-y-2">
                {regionScenarios.map(s => <ScenarioCard key={s.id} scenario={s} onCreateCP={handleCreateCP} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
