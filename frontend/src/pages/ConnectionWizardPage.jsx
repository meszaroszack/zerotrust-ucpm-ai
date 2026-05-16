import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, CheckCircle2, AlertCircle, Building2, ArrowRight, ArrowLeft, Globe2, Key, Shield, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { testOTConnection, createOTOrg, startWorkspace } from '../utils/api';
import { useAppStore } from '../store/appStore';
import { clsx } from 'clsx';

const STEPS = [
  { id: 'credentials', label: 'OT Credentials', icon: Key },
  { id: 'test', label: 'Test Connection', icon: Link2 },
  { id: 'org', label: 'Create Org', icon: Building2 },
  { id: 'brand', label: 'Brand Setup', icon: Shield },
];

function StepIndicator({ steps, current }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={s.id}>
            <div className={clsx('flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300', {
              'bg-brand-primary text-white': active,
              'bg-green-900/40 text-green-400 border border-green-800/50': done,
              'bg-white/5 text-slate-600': !active && !done
            })}>
              {done ? <CheckCircle2 size={12} /> : <s.icon size={12} />}
              <span>{s.label}</span>
            </div>
            {i < steps.length - 1 && <div className={clsx('h-px flex-1', done ? 'bg-green-800/50' : 'bg-white/5')} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function ConnectionWizardPage() {
  const [step, setStep] = useState(0);
  const [creds, setCreds] = useState({
    baseUrl: 'https://app.onetrust.com',
    clientId: '',
    clientSecret: ''
  });
  const [orgName, setOrgName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [createdOrg, setCreatedOrg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [connectionResult, setConnectionResult] = useState(null);

  const { setOTConnection, setWorkspace } = useAppStore();
  const navigate = useNavigate();

  const handleTestConnection = async () => {
    setLoading(true); setError('');
    try {
      const r = await testOTConnection(creds);
      setConnectionResult(r.data);
      setOTConnection(true, creds);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Connection failed. Check your credentials and try again.');
    } finally { setLoading(false); }
  };

  const handleCreateOrg = async () => {
    if (!orgName.trim()) { setError('Org name is required'); return; }
    setLoading(true); setError('');
    try {
      const r = await createOTOrg({ ...creds, orgName, parentOrgName: 'Meszaros - Do Not Touch' });
      setCreatedOrg(r.data.org);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Org creation failed.');
    } finally { setLoading(false); }
  };

  const handleStartWorkspace = async () => {
    if (!brandName.trim()) { setError('Brand name is required'); return; }
    setLoading(true); setError('');
    try {
      const r = await startWorkspace({
        activeOrgId: createdOrg?.id,
        activeOrgName: createdOrg?.name || orgName,
        activeBrandName: brandName,
        otCredentials: creds
      });
      setWorkspace(r.data.workspace);
      navigate('/ai-officer');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start workspace.');
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-brand-primary text-xs font-mono mb-2 uppercase tracking-widest">
          <Link2 size={12} /><span>Setup Wizard</span>
        </div>
        <h1 className="font-heading text-3xl font-bold text-white">Connect & Configure</h1>
        <p className="text-slate-500 text-sm mt-1">Connect to OneTrust and create a new implementation org under the Meszaros testing environment.</p>
      </div>

      <StepIndicator steps={STEPS} current={step} />

      <AnimatePresence mode="wait">
        {/* Step 0 — Credentials */}
        {step === 0 && (
          <motion.div key="creds" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="card-dark p-6">
            <h2 className="font-heading font-semibold text-white mb-1">OneTrust Credentials</h2>
            <p className="text-xs text-slate-500 mb-6">These credentials will be stored for this session only and used to connect to app.onetrust.com.</p>
            
            <div className="space-y-4">
              <div>
                <label className="label-dark">Base URL</label>
                <input value={creds.baseUrl} onChange={e => setCreds(c => ({ ...c, baseUrl: e.target.value }))} className="input-dark font-mono text-xs" />
              </div>
              <div>
                <label className="label-dark">Client ID</label>
                <input value={creds.clientId} onChange={e => setCreds(c => ({ ...c, clientId: e.target.value }))} className="input-dark font-mono" placeholder="your-client-id" />
              </div>
              <div>
                <label className="label-dark">Client Secret</label>
                <input type="password" value={creds.clientSecret} onChange={e => setCreds(c => ({ ...c, clientSecret: e.target.value }))} className="input-dark font-mono" placeholder="your-client-secret" />
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 mt-4 rounded-lg bg-brand-primary/5 border border-brand-primary/15 text-xs text-slate-400">
              <Shield size={13} className="text-brand-primary flex-shrink-0" />
              <span>Credentials are encrypted in transit and stored in the active session only. They are never logged or persisted in plaintext.</span>
            </div>

            <button onClick={() => { setStep(1); setError(''); }} disabled={!creds.clientId || !creds.clientSecret} className="btn-primary mt-5 w-full justify-center">
              Continue <ArrowRight size={15} />
            </button>
          </motion.div>
        )}

        {/* Step 1 — Test Connection */}
        {step === 1 && (
          <motion.div key="test" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="card-dark p-6">
            <h2 className="font-heading font-semibold text-white mb-1">Test Connection</h2>
            <p className="text-xs text-slate-500 mb-6">Verify your credentials against <span className="font-mono text-slate-400">{creds.baseUrl}</span></p>

            <div className="p-4 rounded-xl bg-white/3 border border-white/6 mb-5 space-y-2 text-xs font-mono">
              <div className="flex gap-3"><span className="text-slate-600 w-20 flex-shrink-0">Base URL:</span><span className="text-slate-300">{creds.baseUrl}</span></div>
              <div className="flex gap-3"><span className="text-slate-600 w-20 flex-shrink-0">Client ID:</span><span className="text-slate-300">{creds.clientId.slice(0, 8)}••••</span></div>
              <div className="flex gap-3"><span className="text-slate-600 w-20 flex-shrink-0">Secret:</span><span className="text-slate-300">••••••••</span></div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-red-400 text-sm mb-4">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setStep(0); setError(''); }} className="btn-secondary"><ArrowLeft size={15} /> Back</button>
              <button onClick={handleTestConnection} disabled={loading} className="btn-primary flex-1 justify-center">
                {loading ? <><Loader2 size={15} className="animate-spin" /> Testing...</> : <><Link2 size={15} /> Test Connection</>}
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 2 — Create Org */}
        {step === 2 && (
          <motion.div key="org" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="card-dark p-6">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 size={16} className="text-green-400" />
              <h2 className="font-heading font-semibold text-white">Connection Successful</h2>
            </div>
            <p className="text-xs text-slate-500 mb-6">Create a new org under the <span className="text-brand-gold font-medium">Meszaros - Do Not Touch</span> parent org.</p>

            <div className="mb-4">
              <label className="label-dark">New Org Name</label>
              <input value={orgName} onChange={e => setOrgName(e.target.value)} className="input-dark" placeholder="e.g. ACME Corp – ZeroTrust Test 01" />
              <p className="text-xs text-slate-600 mt-1.5">This org will be created as a child of <span className="font-mono text-slate-500">Meszaros - Do Not Touch</span></p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-red-400 text-sm mb-4">
                <AlertCircle size={15} /><span>{error}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="btn-secondary"><ArrowLeft size={15} /> Back</button>
              <button onClick={handleCreateOrg} disabled={loading || !orgName} className="btn-primary flex-1 justify-center">
                {loading ? <><Loader2 size={15} className="animate-spin" /> Creating...</> : <><Building2 size={15} /> Create Org</>}
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3 — Brand */}
        {step === 3 && (
          <motion.div key="brand" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="card-dark p-6">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 size={16} className="text-green-400" />
              <h2 className="font-heading font-semibold text-white">Org Created</h2>
            </div>
            
            {createdOrg && (
              <div className="p-3 rounded-lg bg-green-950/30 border border-green-900/30 text-xs font-mono text-green-400 mb-5">
                <div>Name: {createdOrg.name}</div>
                <div>ID: {createdOrg.id}</div>
                {createdOrg.simulated && <div className="text-amber-400 mt-1">⚠ {createdOrg.warning}</div>}
              </div>
            )}

            <div className="mb-4">
              <label className="label-dark">Brand / Company Name</label>
              <input value={brandName} onChange={e => setBrandName(e.target.value)} className="input-dark" placeholder="e.g. ACME Corporation" autoFocus />
              <p className="text-xs text-slate-600 mt-1.5">This is the brand you are implementing the consent program for.</p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-red-400 text-sm mb-4">
                <AlertCircle size={15} /><span>{error}</span>
              </div>
            )}

            <button onClick={handleStartWorkspace} disabled={loading || !brandName} className="btn-accent w-full justify-center">
              {loading ? <><Loader2 size={15} className="animate-spin" /> Starting...</> : <><Shield size={15} /> Start Implementation Session</>}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
