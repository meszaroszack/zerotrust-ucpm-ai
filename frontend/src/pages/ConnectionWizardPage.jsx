import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Link2, CheckCircle2, AlertCircle, Building2, ArrowRight, ArrowLeft,
  Key, Shield, Loader2, Info, Sparkles, Lock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { testOTConnection, createOTOrg, startWorkspace } from '../utils/api';
import { useAppStore } from '../store/appStore';
import api from '../utils/api';
import { clsx } from 'clsx';

const STEPS = [
  { id: 'credentials', label: 'OneTrust Access', icon: Key },
  { id: 'verify', label: 'Verify Connection', icon: Link2 },
  { id: 'org', label: 'New Workspace', icon: Building2 },
  { id: 'brand', label: 'Brand Setup', icon: Shield },
];

function StepTrack({ steps, current }) {
  return (
    <div className="flex items-center mb-8">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={s.id}>
            <div className="flex items-center gap-2">
              <div className={clsx(
                'w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 text-xs font-bold',
                done ? 'bg-green-500 text-white' : active ? 'bg-brand-primary text-white' : 'bg-white/10 text-slate-600'
              )}>
                {done ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              {active && <span className="text-xs font-medium text-white hidden sm:block">{s.label}</span>}
            </div>
            {i < steps.length - 1 && (
              <div className={clsx('flex-1 h-px mx-2 transition-colors duration-300', done ? 'bg-green-500/40' : 'bg-white/5')} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function ConnectionWizardPage() {
  const [step, setStep] = useState(0);
  const [savedCreds, setSavedCreds] = useState(null);
  const [useExisting, setUseExisting] = useState(false);

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
  const [orgWarning, setOrgWarning] = useState('');

  const { setOTConnection, setWorkspace } = useAppStore();
  const navigate = useNavigate();

  // Load saved credentials on mount
  useEffect(() => {
    api.get('/onetrust/saved-credentials')
      .then(r => {
        if (r.data.prefilled) {
          setSavedCreds(r.data);
          setCreds(c => ({ ...c, baseUrl: r.data.baseUrl }));
          setUseExisting(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleTestConnection = async () => {
    setLoading(true); setError('');
    const payload = useExisting && savedCreds?.prefilled
      ? { baseUrl: creds.baseUrl } // backend will use saved creds
      : creds;
    try {
      const r = await testOTConnection(payload);
      setOTConnection(true, creds);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Connection failed — please check your credentials and try again.');
    } finally { setLoading(false); }
  };

  const handleCreateOrg = async () => {
    if (!orgName.trim()) { setError('Please give this workspace a name.'); return; }
    setLoading(true); setError(''); setOrgWarning('');
    const payload = useExisting && savedCreds?.prefilled
      ? { orgName }
      : { ...creds, orgName };
    try {
      const r = await createOTOrg(payload);
      setCreatedOrg(r.data.org);
      if (r.data.warning) setOrgWarning(r.data.warning);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create the workspace. Please try again.');
    } finally { setLoading(false); }
  };

  const handleStartWorkspace = async () => {
    if (!brandName.trim()) { setError('Please enter the brand name.'); return; }
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
      setError(err.response?.data?.error || 'Could not start the session. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-xl mx-auto animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-brand-primary text-xs font-mono mb-2 uppercase tracking-widest">
          <Link2 size={12} /><span>New Implementation</span>
        </div>
        <h1 className="font-heading text-3xl font-bold text-white">Connect to OneTrust</h1>
        <p className="text-slate-500 text-sm mt-1">
          Connect your OneTrust environment and create a new workspace for this implementation.
        </p>
      </div>

      <StepTrack steps={STEPS} current={step} />

      <AnimatePresence mode="wait">

        {/* Step 0 — Credentials */}
        {step === 0 && (
          <motion.div key="creds" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="card-dark p-6">
            <h2 className="font-heading font-semibold text-white mb-1">OneTrust Credentials</h2>
            <p className="text-sm text-slate-500 mb-5">Enter your OneTrust API credentials to connect. These are the same credentials used to access the OneTrust platform.</p>

            {savedCreds?.prefilled && (
              <div className="p-3 rounded-xl bg-green-950/30 border border-green-800/30 mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 size={14} className="text-green-400" />
                  <span className="text-sm font-medium text-green-400">Saved credentials found</span>
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  You have OneTrust credentials saved from your last session.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => { setUseExisting(true); setStep(1); }} className="btn-accent flex-1 justify-center text-xs py-2">
                    Use saved credentials <ArrowRight size={13} />
                  </button>
                  <button onClick={() => setUseExisting(false)} className={clsx('btn-secondary text-xs py-2 flex-1 justify-center', !useExisting && 'border-brand-primary/40 text-brand-primary')}>
                    Enter new credentials
                  </button>
                </div>
              </div>
            )}

            {(!savedCreds?.prefilled || !useExisting) && (
              <div className="space-y-4">
                <div>
                  <label className="label-dark">OneTrust URL</label>
                  <input value={creds.baseUrl} onChange={e => setCreds(c => ({ ...c, baseUrl: e.target.value }))} className="input-dark font-mono text-xs" />
                </div>
                <div>
                  <label className="label-dark">Client ID</label>
                  <input value={creds.clientId} onChange={e => setCreds(c => ({ ...c, clientId: e.target.value }))} className="input-dark font-mono text-xs" placeholder="Your OneTrust OAuth client ID" />
                </div>
                <div>
                  <label className="label-dark">Client Secret</label>
                  <input type="password" value={creds.clientSecret} onChange={e => setCreds(c => ({ ...c, clientSecret: e.target.value }))} className="input-dark font-mono text-xs" placeholder="Your OneTrust OAuth client secret" />
                </div>

                <div className="flex items-start gap-2 p-3 rounded-lg bg-white/3 border border-white/5 text-xs text-slate-500">
                  <Lock size={12} className="text-brand-primary mt-0.5 flex-shrink-0" />
                  Credentials are only used to connect to your OneTrust environment and are never stored in plain text outside this session.
                </div>

                <button
                  onClick={() => setStep(1)}
                  disabled={!creds.clientId || !creds.clientSecret}
                  className="btn-primary w-full justify-center"
                >
                  Continue <ArrowRight size={15} />
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Step 1 — Verify */}
        {step === 1 && (
          <motion.div key="verify" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="card-dark p-6">
            <h2 className="font-heading font-semibold text-white mb-1">Verify Connection</h2>
            <p className="text-sm text-slate-500 mb-5">
              {useExisting && savedCreds?.prefilled
                ? `Testing your saved credentials against ${savedCreds.baseUrl}`
                : `Testing your credentials against ${creds.baseUrl}`}
            </p>

            <div className="p-4 rounded-xl bg-white/3 border border-white/5 mb-5 space-y-2">
              <div className="flex gap-3 text-xs">
                <span className="text-slate-600 w-24 flex-shrink-0">Environment:</span>
                <span className="text-slate-300 font-mono">{creds.baseUrl}</span>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="text-slate-600 w-24 flex-shrink-0">Client ID:</span>
                <span className="text-slate-300 font-mono">
                  {useExisting && savedCreds ? savedCreds.clientIdPrefix : (creds.clientId.slice(0, 8) + '••••')}
                </span>
              </div>
              <div className="flex gap-3 text-xs">
                <span className="text-slate-600 w-24 flex-shrink-0">Parent Org:</span>
                <span className="text-brand-gold font-medium text-xs">Meszaros - Do Not Touch</span>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-red-400 text-sm mb-4">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setStep(0); setError(''); }} className="btn-secondary"><ArrowLeft size={15} />Back</button>
              <button onClick={handleTestConnection} disabled={loading} className="btn-primary flex-1 justify-center">
                {loading ? <><Loader2 size={15} className="animate-spin" />Testing connection...</> : <><Link2 size={15} />Test Connection</>}
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 2 — Create Org */}
        {step === 2 && (
          <motion.div key="org" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="card-dark p-6">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 size={16} className="text-green-400" />
              <h2 className="font-heading font-semibold text-white">Connected</h2>
            </div>
            <p className="text-sm text-slate-500 mb-5">
              Give this implementation a name. A new OneTrust workspace will be created under <span className="text-brand-gold font-medium">Meszaros - Do Not Touch</span>.
            </p>

            <div className="mb-2">
              <label className="label-dark">Workspace Name</label>
              <input
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                className="input-dark"
                placeholder="e.g. Acme Corp — Consent Program 2026"
                autoFocus
              />
              <p className="text-xs text-slate-600 mt-1.5">This name appears in OneTrust as a child of the Meszaros testing environment.</p>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-red-400 text-sm mb-4 mt-4">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" /><span>{error}</span>
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={() => setStep(1)} className="btn-secondary"><ArrowLeft size={15} />Back</button>
              <button onClick={handleCreateOrg} disabled={loading || !orgName.trim()} className="btn-primary flex-1 justify-center">
                {loading ? <><Loader2 size={15} className="animate-spin" />Creating workspace...</> : <><Building2 size={15} />Create Workspace</>}
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3 — Brand */}
        {step === 3 && (
          <motion.div key="brand" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="card-dark p-6">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 size={16} className="text-green-400" />
              <h2 className="font-heading font-semibold text-white">Workspace Created</h2>
            </div>

            {createdOrg && (
              <div className={clsx(
                'p-3 rounded-lg text-xs font-mono mb-5 mt-2',
                createdOrg.simulated
                  ? 'bg-amber-950/30 border border-amber-900/30 text-amber-400'
                  : 'bg-green-950/30 border border-green-900/30 text-green-400'
              )}>
                {createdOrg.simulated ? (
                  <>⚠ Simulated workspace: <strong>{createdOrg.name}</strong><br /><span className="text-slate-500 text-[11px] mt-1 block">{orgWarning}</span></>
                ) : (
                  <>✓ <strong>{createdOrg.name}</strong> created in OneTrust (ID: {createdOrg.id})</>
                )}
              </div>
            )}

            <p className="text-sm text-slate-500 mb-4">Who is this implementation for? Enter the brand or company name.</p>

            <div>
              <label className="label-dark">Brand / Company Name</label>
              <input
                value={brandName}
                onChange={e => setBrandName(e.target.value)}
                className="input-dark"
                placeholder="e.g. Acme Corporation"
                autoFocus
              />
              <p className="text-xs text-slate-600 mt-1.5">This is shown throughout the app and used in AI recommendations.</p>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-red-400 text-sm mt-4">
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" /><span>{error}</span>
              </div>
            )}

            <button onClick={handleStartWorkspace} disabled={loading || !brandName.trim()} className="btn-accent w-full justify-center mt-5 py-3">
              {loading
                ? <><Loader2 size={15} className="animate-spin" />Starting session...</>
                : <><Sparkles size={15} />Start Implementation</>}
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
