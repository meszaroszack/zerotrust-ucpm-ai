import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Key, Brain, Globe2, Shield, Zap, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, Save } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getSettings, saveSettings } from '../utils/api';
import { clsx } from 'clsx';

const PROVIDERS = [
  { id: 'perplexity', name: 'Perplexity', status: 'live', desc: 'Primary AI provider. Powers all analysis and generation.' },
  { id: 'openai', name: 'OpenAI', status: 'placeholder', desc: 'GPT-4o and GPT-4 series. Scaffold ready for activation.' },
  { id: 'anthropic', name: 'Anthropic', status: 'placeholder', desc: 'Claude 3.5 Sonnet. Scaffold ready for activation.' },
  { id: 'gemini', name: 'Google Gemini', status: 'placeholder', desc: 'Gemini 1.5 Pro. Scaffold ready for activation.' },
  { id: 'azureOpenAI', name: 'Azure OpenAI', status: 'placeholder', desc: 'Enterprise Azure deployment. Requires endpoint config.' },
  { id: 'bedrock', name: 'AWS Bedrock', status: 'placeholder', desc: 'AWS-hosted foundation models. Requires IAM credentials.' },
];

const TABS = [
  { id: 'ai', label: 'AI Providers', icon: Brain },
  { id: 'app', label: 'App Access', icon: Shield },
  { id: 'workspace', label: 'Active Workspace', icon: Globe2 },
];

function ProviderCard({ provider, config, onChange }) {
  const [showKey, setShowKey] = useState(false);
  const isLive = provider.status === 'live';
  const isEnabled = config?.enabled || false;

  return (
    <div className={clsx('card-dark p-4 border', isLive ? 'border-brand-accent/20' : 'border-white/5')}>
      <div className="flex items-center gap-3 mb-3">
        <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', isLive ? 'bg-brand-accent/15' : 'bg-white/5')}>
          <Zap size={14} className={isLive ? 'text-brand-accent' : 'text-slate-600'} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-heading font-semibold text-white text-sm">{provider.name}</span>
            {isLive && <span className="badge bg-green-950 border-green-800 text-green-400 text-[10px]">Active</span>}
            {!isLive && <span className="badge bg-slate-800 border-slate-700 text-slate-500 text-[10px]">Scaffold</span>}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{provider.desc}</p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={isEnabled} onChange={e => onChange(provider.id, 'enabled', e.target.checked)} className="sr-only" />
          <div className={clsx('w-9 h-5 rounded-full transition-colors', isEnabled ? 'bg-brand-primary' : 'bg-white/10')}>
            <div className={clsx('w-4 h-4 bg-white rounded-full shadow transform transition-transform mt-0.5', isEnabled ? 'translate-x-4.5' : 'translate-x-0.5')} style={{ transform: isEnabled ? 'translateX(18px)' : 'translateX(2px)' }} />
          </div>
        </label>
      </div>

      <div className="space-y-2">
        <div>
          <label className="label-dark">Model</label>
          <input
            value={config?.model || ''}
            onChange={e => onChange(provider.id, 'model', e.target.value)}
            className="input-dark font-mono text-xs"
            placeholder={provider.id === 'perplexity' ? 'llama-3.1-sonar-large-128k-online' : 'model-name'}
          />
        </div>
        <div>
          <label className="label-dark">API Key</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={config?.apiKey || ''}
              onChange={e => onChange(provider.id, 'apiKey', e.target.value)}
              className="input-dark font-mono text-xs pr-10"
              placeholder="sk-..."
            />
            <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
              {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>
        {provider.id === 'azureOpenAI' && (
          <div>
            <label className="label-dark">Azure Endpoint</label>
            <input value={config?.endpoint || ''} onChange={e => onChange(provider.id, 'endpoint', e.target.value)} className="input-dark font-mono text-xs" placeholder="https://your-resource.openai.azure.com/" />
          </div>
        )}
        {provider.id === 'bedrock' && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label-dark">Region</label>
              <input value={config?.region || 'us-east-1'} onChange={e => onChange(provider.id, 'region', e.target.value)} className="input-dark font-mono text-xs" />
            </div>
            <div>
              <label className="label-dark">Access Key ID</label>
              <input value={config?.accessKeyId || ''} onChange={e => onChange(provider.id, 'accessKeyId', e.target.value)} className="input-dark font-mono text-xs" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('ai');
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    onSuccess: (r) => setSettings(r.data)
  });

  // Also fetch on mount
  React.useEffect(() => {
    getSettings().then(r => setSettings(r.data)).catch(() => {});
  }, []);

  const handleProviderChange = (providerId, field, value) => {
    setSettings(s => ({
      ...s,
      aiProviders: {
        ...s.aiProviders,
        [providerId]: { ...s.aiProviders?.[providerId], [field]: value }
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      alert('Save failed: ' + e.message);
    } finally { setSaving(false); }
  };

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-slate-500 text-xs font-mono mb-2 uppercase tracking-widest">
          <Settings size={12} /><span>Configuration</span>
        </div>
        <h1 className="font-heading text-3xl font-bold text-white">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Configure AI providers, app access, and workspace behavior.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/3 rounded-xl mb-6 border border-white/5 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={clsx('flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all', {
              'bg-brand-primary text-white': t.id === activeTab,
              'text-slate-500 hover:text-white': t.id !== activeTab
            })}>
            <t.icon size={13} />{t.label}
          </button>
        ))}
      </div>

      {activeTab === 'ai' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-brand-primary/5 border border-brand-primary/15 text-xs text-slate-400 mb-4">
            <Brain size={13} className="text-brand-primary" />
            <span>Perplexity is the active AI provider. Other providers are scaffolded and ready for API key activation.</span>
          </div>
          {PROVIDERS.map(p => (
            <ProviderCard
              key={p.id}
              provider={p}
              config={settings.aiProviders?.[p.id] || {}}
              onChange={handleProviderChange}
            />
          ))}
        </div>
      )}

      {activeTab === 'app' && (
        <div className="card-dark p-5">
          <h3 className="font-heading font-semibold text-white mb-4">App Access</h3>
          <div className="space-y-2 text-xs text-slate-500">
            <div className="flex gap-2"><span className="text-slate-600 w-32">Admin Email:</span><span className="font-mono text-slate-400">{import.meta.env.VITE_ADMIN_EMAIL || 'Set via APP_ADMIN_EMAIL env var'}</span></div>
            <div className="flex gap-2"><span className="text-slate-600 w-32">Auth Method:</span><span className="font-mono text-slate-400">JWT (24h expiry)</span></div>
            <div className="flex gap-2"><span className="text-slate-600 w-32">SSO:</span><span className="font-mono text-slate-400">Future-ready (Auth0 scaffold)</span></div>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-amber-950/20 border border-amber-900/20 text-xs text-amber-400">
            App credentials are configured via environment variables (APP_ADMIN_EMAIL, APP_ADMIN_PASSWORD). To change them, update your Railway env and redeploy.
          </div>
        </div>
      )}

      {activeTab === 'workspace' && (
        <div className="card-dark p-5">
          <h3 className="font-heading font-semibold text-white mb-4">Active Workspace</h3>
          <p className="text-xs text-slate-500 mb-4">Workspace state is persisted server-side in <span className="font-mono">backend/data/workspace.json</span>. Use the Reset Program button in the sidebar to start a new session.</p>
          <div className="space-y-2 text-xs">
            <div className="flex gap-2"><span className="text-slate-600 w-36">Persistence:</span><span className="text-slate-400">Server-side JSON</span></div>
            <div className="flex gap-2"><span className="text-slate-600 w-36">History:</span><span className="text-slate-400">Last 20 sessions preserved after reset</span></div>
            <div className="flex gap-2"><span className="text-slate-600 w-36">Reset behavior:</span><span className="text-slate-400">Clears session state only — OT artifacts NOT deleted</span></div>
            <div className="flex gap-2"><span className="text-slate-600 w-36">Parent Org:</span><span className="font-mono text-brand-gold">Meszaros - Do Not Touch</span></div>
          </div>
        </div>
      )}

      {/* Save */}
      {activeTab === 'ai' && (
        <div className="mt-6 flex justify-end">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <><Loader2 size={15} className="animate-spin" />Saving...</> :
             saved ? <><CheckCircle2 size={15} className="text-green-400" />Saved!</> :
             <><Save size={15} />Save Settings</>}
          </button>
        </div>
      )}
    </div>
  );
}
