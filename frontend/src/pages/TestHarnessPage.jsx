import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FlaskConical, Globe2, Languages, Map, Copy, CheckCircle2, RefreshCw, Loader2, ExternalLink, Info } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { getGeoPreview } from '../utils/api';
import { clsx } from 'clsx';

const PRESETS = [
  { label: '🇩🇪 Germany', params: { countryCode: 'DE', regionCode: 'EU', lang: 'de' }, posture: 'opt-in', desc: 'GDPR — Strict opt-in required' },
  { label: '🇬🇧 United Kingdom', params: { countryCode: 'GB', lang: 'en' }, posture: 'opt-in', desc: 'UK GDPR — Opt-in banner required' },
  { label: '🇺🇸 California', params: { countryCode: 'US', stateCode: 'CA', lang: 'en' }, posture: 'opt-out', desc: 'CCPA/CPRA — Opt-out model' },
  { label: '🇺🇸 US General', params: { countryCode: 'US', lang: 'en' }, posture: 'notice-only', desc: 'US general — Notice-only fallback' },
  { label: '🇨🇦 Canada', params: { countryCode: 'CA', lang: 'en' }, posture: 'opt-in', desc: 'PIPEDA/Quebec Law 25' },
  { label: '🌍 Global Fallback', params: { countryCode: 'GLOBAL', lang: 'en' }, posture: 'notice-only', desc: 'Default global posture' },
];

const POSTURE_COLORS = {
  'opt-in': 'bg-blue-950 border-blue-800 text-blue-300',
  'opt-out': 'bg-amber-950 border-amber-800 text-amber-300',
  'notice-only': 'bg-slate-800 border-slate-700 text-slate-300',
  'legitimate-interest': 'bg-purple-950 border-purple-800 text-purple-300',
};

function ParamInput({ label, value, onChange, placeholder, mono }) {
  return (
    <div>
      <label className="label-dark">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        className={clsx('input-dark', mono && 'font-mono')}
        placeholder={placeholder}
      />
    </div>
  );
}

export default function TestHarnessPage() {
  const [searchParams] = useSearchParams();
  const [params, setParams] = useState({
    countryCode: searchParams.get('countryCode') || 'DE',
    stateCode: searchParams.get('stateCode') || '',
    regionCode: searchParams.get('regionCode') || '',
    lang: searchParams.get('lang') || 'de',
    otgeo: searchParams.get('otgeo') || '',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const testUrl = `${window.location.origin}/test-harness?${new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString()}`;

  const handlePreview = async () => {
    setLoading(true);
    try {
      const r = await getGeoPreview(params);
      setResult(r.data);
    } catch (e) {
      alert('Preview failed: ' + e.message);
    } finally { setLoading(false); }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(testUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const applyPreset = (preset) => {
    setParams(p => ({ ...p, ...preset.params, stateCode: preset.params.stateCode || '', regionCode: preset.params.regionCode || '', otgeo: '' }));
    setResult(null);
  };

  // Auto-preview on mount if params from URL
  useEffect(() => {
    if (searchParams.get('countryCode')) handlePreview();
  }, []);

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-brand-accent text-xs font-mono mb-2 uppercase tracking-widest">
          <FlaskConical size={12} /><span>Test Harness</span>
        </div>
        <h1 className="font-heading text-3xl font-bold text-white">Experience Preview</h1>
        <p className="text-slate-500 text-sm mt-1">Simulate geo/language experiences through URL decoration. No real user data is used.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Controls */}
        <div className="lg:col-span-1 space-y-4">
          {/* Presets */}
          <div className="card-dark p-4">
            <div className="section-header">Quick Presets</div>
            <div className="space-y-1.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  className={clsx(
                    'w-full text-left p-2.5 rounded-lg text-xs transition-all border',
                    params.countryCode === preset.params.countryCode && params.stateCode === (preset.params.stateCode || '')
                      ? 'bg-brand-primary/10 border-brand-primary/30 text-white'
                      : 'bg-white/3 border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  <div className="font-medium">{preset.label}</div>
                  <div className="text-slate-600 text-[11px] mt-0.5">{preset.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Manual params */}
          <div className="card-dark p-4 space-y-3">
            <div className="section-header">Manual Parameters</div>
            <ParamInput label="Country Code" value={params.countryCode} onChange={v => setParams(p => ({ ...p, countryCode: v.toUpperCase() }))} placeholder="DE, US, GB, CA..." mono />
            <ParamInput label="State Code" value={params.stateCode} onChange={v => setParams(p => ({ ...p, stateCode: v.toUpperCase() }))} placeholder="CA (California), NY..." mono />
            <ParamInput label="Region Code" value={params.regionCode} onChange={v => setParams(p => ({ ...p, regionCode: v.toUpperCase() }))} placeholder="EU, APAC..." mono />
            <ParamInput label="Language" value={params.lang} onChange={v => setParams(p => ({ ...p, lang: v.toLowerCase() }))} placeholder="en, de, fr, es..." mono />
            <ParamInput label="OT Geo Override" value={params.otgeo} onChange={v => setParams(p => ({ ...p, otgeo: v }))} placeholder="us,ca (OT format)" mono />
          </div>

          <button onClick={handlePreview} disabled={loading} className="btn-primary w-full justify-center">
            {loading ? <><Loader2 size={15} className="animate-spin" />Simulating...</> : <><Globe2 size={15} />Simulate Experience</>}
          </button>
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-2 space-y-4">
          {/* Test URL */}
          <div className="card-dark p-4">
            <div className="section-header">Test URL</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-brand-accent bg-brand-accent/5 px-3 py-2 rounded-lg border border-brand-accent/15 font-mono truncate">
                {testUrl}
              </code>
              <button onClick={handleCopy} className={clsx('btn-ghost flex-shrink-0', copied && 'text-green-400')}>
                {copied ? <CheckCircle2 size={15} /> : <Copy size={15} />}
              </button>
            </div>
          </div>

          {/* Result */}
          {result ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
              {/* Matched scenario */}
              {result.matchedScenario ? (
                <div className="card-dark p-4 border border-brand-primary/20">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 size={15} className="text-green-400" />
                    <span className="font-heading font-semibold text-white text-sm">Matched Scenario</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><span className="text-slate-500">Scenario:</span> <span className="text-white font-medium">{result.matchedScenario.name}</span></div>
                    <div><span className="text-slate-500">Region:</span> <span className="text-white">{result.matchedScenario.region}</span></div>
                    <div><span className="text-slate-500">Language:</span> <span className="text-white">{result.matchedScenario.language}</span></div>
                    <div>
                      <span className="text-slate-500">Posture:</span>{' '}
                      <span className={clsx('badge border text-[10px]', POSTURE_COLORS[result.matchedScenario.consentPosture])}>
                        {result.matchedScenario.consentPosture}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card-dark p-4 border border-amber-900/30">
                  <div className="flex items-center gap-2 text-amber-400 text-sm">
                    <Info size={14} />
                    <span>No matching scenario found. Using global fallback.</span>
                  </div>
                </div>
              )}

              {/* Consent model */}
              <div className="card-dark p-4">
                <div className="section-header">Recommended Consent Model</div>
                <div className={clsx('inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium', POSTURE_COLORS[result.consentModel])}>
                  <Globe2 size={16} />
                  {result.consentModel?.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </div>
              </div>

              {/* Linked CP */}
              {result.linkedCollectionPoint && (
                <div className="card-dark p-4">
                  <div className="section-header">Linked Collection Point</div>
                  <div className="p-3 rounded-lg bg-brand-primary/5 border border-brand-primary/15 text-xs">
                    <div className="font-medium text-white mb-0.5">{result.linkedCollectionPoint.name}</div>
                    <div className="text-slate-500 font-mono">{result.linkedCollectionPoint.otId || 'draft — not yet in OT'}</div>
                  </div>
                </div>
              )}

              {/* Visual experience mock */}
              <div className="card-dark p-4">
                <div className="section-header">Simulated Banner Experience</div>
                <div className="bg-bg-dark rounded-xl p-4 border border-white/5 relative overflow-hidden">
                  {/* Mock website */}
                  <div className="h-24 bg-white/3 rounded-lg mb-3 flex items-center justify-center text-slate-700 text-xs">
                    [Website Content — {params.countryCode}{params.stateCode ? `/${params.stateCode}` : ''} · {params.lang}]
                  </div>
                  {/* Mock banner */}
                  <div className={clsx('rounded-lg p-3 border text-xs', {
                    'bg-brand-primary/10 border-brand-primary/30': result.consentModel === 'opt-in',
                    'bg-amber-950/30 border-amber-900/30': result.consentModel === 'opt-out',
                    'bg-slate-800/50 border-slate-700': result.consentModel === 'notice-only',
                  })}>
                    <div className="font-medium text-white mb-1">
                      {result.consentModel === 'opt-in' && '🔒 We use cookies — your consent is required'}
                      {result.consentModel === 'opt-out' && '⚙️ Manage your privacy preferences'}
                      {result.consentModel === 'notice-only' && 'ℹ️ This site uses cookies — continued use implies acceptance'}
                      {result.consentModel === 'legitimate-interest' && 'ℹ️ Privacy notice — no action required'}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <span className="px-2 py-1 bg-brand-primary text-white rounded text-[11px]">
                        {result.consentModel === 'opt-in' ? 'Accept All' : 'OK'}
                      </span>
                      {result.consentModel === 'opt-in' && <span className="px-2 py-1 bg-white/10 text-slate-300 rounded text-[11px]">Reject All</span>}
                      <span className="px-2 py-1 bg-white/5 text-slate-400 rounded text-[11px]">Preferences</span>
                    </div>
                  </div>
                  <div className="absolute top-2 right-2">
                    <span className="badge bg-brand-gold/10 border-brand-gold/30 text-brand-gold text-[10px]">SIMULATION ONLY</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-900 border border-white/5 text-xs text-slate-600">
                <Info size={12} className="flex-shrink-0" />
                {result.previewNote}
              </div>
            </motion.div>
          ) : (
            <div className="card-dark p-12 text-center">
              <Globe2 size={36} className="mx-auto text-slate-700 mb-4" />
              <p className="text-slate-500 text-sm">Select a preset or enter parameters and click Simulate Experience.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
