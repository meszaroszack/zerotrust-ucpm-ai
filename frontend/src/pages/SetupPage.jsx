import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, User, Brain, CheckCircle2, ArrowRight, Eye, EyeOff,
  Loader2, AlertCircle, ExternalLink, Lock, Zap, Key, Info
} from 'lucide-react';
import { saveAdminAccount, saveAIKey, completeSetup } from '../utils/api';
import { clsx } from 'clsx';

const STEPS = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'account', label: 'Your Account' },
  { id: 'ai', label: 'AI Connection' },
  { id: 'done', label: 'Ready' },
];

function StepDots({ steps, current }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-10">
      {steps.map((s, i) => (
        <div key={s.id} className={clsx(
          'transition-all duration-300 rounded-full',
          i === current ? 'w-6 h-2 bg-brand-primary' : i < current ? 'w-2 h-2 bg-green-500' : 'w-2 h-2 bg-white/10'
        )} />
      ))}
    </div>
  );
}

export default function SetupPage({ onComplete }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Account step
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  // AI step
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keyVerified, setKeyVerified] = useState(false);

  const handleSaveAccount = async () => {
    if (!email || !password) { setError('Both fields are required.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true); setError('');
    try {
      await saveAdminAccount({ email, password });
      setStep(2);
    } catch (e) {
      setError(e.response?.data?.error || 'Could not save your account. Please try again.');
    } finally { setLoading(false); }
  };

  const handleSaveAI = async () => {
    if (!apiKey.trim()) { setError('Please enter your Perplexity API key.'); return; }
    setLoading(true); setError('');
    try {
      await saveAIKey({ perplexityApiKey: apiKey.trim() });
      setKeyVerified(true);
      setTimeout(() => setStep(3), 600);
    } catch (e) {
      setError(e.response?.data?.error || 'That key did not work. Double-check it and try again.');
    } finally { setLoading(false); }
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      await completeSetup();
      onComplete();
    } catch {
      onComplete(); // proceed anyway
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(11,95,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(11,95,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-lg px-4">
        {/* Logo */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-primary/15 border border-brand-primary/30 rounded-2xl mb-4">
            <Shield size={28} className="text-brand-primary" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-white">ZEROTRUST AI</h1>
          <p className="text-slate-500 text-sm mt-1">Let's get you set up. This takes about two minutes.</p>
        </motion.div>

        <StepDots steps={STEPS} current={step} />

        <AnimatePresence mode="wait">

          {/* Step 0 — Welcome */}
          {step === 0 && (
            <motion.div key="welcome" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
              <div className="card-dark p-8 text-center">
                <div className="text-4xl mb-4">👋</div>
                <h2 className="font-heading text-xl font-bold text-white mb-3">Welcome to ZEROTRUST AI</h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  This tool connects directly to OneTrust on your behalf. It reads your requirements — in plain English or as a document — and builds a real consent program, asking you smart questions along the way.
                </p>

                <div className="space-y-3 mb-8 text-left">
                  {[
                    { icon: '📄', text: 'Upload a requirements doc or describe your program in plain English' },
                    { icon: '🤖', text: 'AI asks expert follow-up questions about your business and regions' },
                    { icon: '⚡', text: 'Creates real OneTrust objects — purposes, data elements, collection points' },
                    { icon: '🌍', text: 'Generates a geo and language testing harness you can demo instantly' },
                  ].map((item) => (
                    <div key={item.text} className="flex items-start gap-3 p-3 rounded-lg bg-white/3 border border-white/5">
                      <span className="text-lg flex-shrink-0">{item.icon}</span>
                      <span className="text-sm text-slate-400">{item.text}</span>
                    </div>
                  ))}
                </div>

                <button onClick={() => setStep(1)} className="btn-primary w-full justify-center py-3 text-base">
                  Get Started <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 1 — Admin Account */}
          {step === 1 && (
            <motion.div key="account" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
              <div className="card-dark p-7">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-brand-primary/15 flex items-center justify-center">
                    <User size={18} className="text-brand-primary" />
                  </div>
                  <h2 className="font-heading text-lg font-bold text-white">Create Your Account</h2>
                </div>
                <p className="text-slate-500 text-sm mb-6 ml-12">This is how you'll sign in every time. Keep your password somewhere safe.</p>

                {error && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-red-400 text-sm mb-5">
                    <AlertCircle size={15} />{error}
                  </motion.div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="label-dark">Email address</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-dark" placeholder="you@yourfirm.com" autoFocus />
                  </div>
                  <div>
                    <label className="label-dark">Password</label>
                    <div className="relative">
                      <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className="input-dark pr-10" placeholder="At least 8 characters" />
                      <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                        {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="label-dark">Confirm password</label>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="input-dark" placeholder="Same password again" />
                  </div>
                </div>

                <button onClick={handleSaveAccount} disabled={loading || !email || !password || !confirmPassword} className="btn-primary w-full justify-center mt-6 py-3">
                  {loading ? <><Loader2 size={15} className="animate-spin" />Saving...</> : <>Continue <ArrowRight size={15} /></>}
                </button>

                <div className="flex items-center gap-2 mt-4 p-3 rounded-lg bg-white/3 border border-white/5 text-xs text-slate-500">
                  <Lock size={12} className="text-brand-primary flex-shrink-0" />
                  Your credentials are stored securely on this server only — never shared with third parties.
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2 — AI Key */}
          {step === 2 && (
            <motion.div key="ai" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
              <div className="card-dark p-7">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-brand-accent/15 flex items-center justify-center">
                    <Brain size={18} className="text-brand-accent" />
                  </div>
                  <h2 className="font-heading text-lg font-bold text-white">Connect the AI</h2>
                </div>
                <p className="text-slate-500 text-sm mb-6 ml-12">
                  ZEROTRUST AI uses Perplexity to do its thinking. You'll need a Perplexity API key to continue.
                </p>

                {error && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-red-400 text-sm mb-5">
                    <AlertCircle size={15} />{error}
                  </motion.div>
                )}

                {/* How to get key */}
                <div className="p-4 rounded-xl bg-brand-accent/5 border border-brand-accent/15 mb-5">
                  <div className="text-xs font-semibold text-brand-accent mb-2 flex items-center gap-1.5">
                    <Info size={12} />How to get your Perplexity API key
                  </div>
                  <ol className="space-y-1.5 text-xs text-slate-400">
                    <li>1. Go to <a href="https://www.perplexity.ai/settings/api" target="_blank" rel="noopener noreferrer" className="text-brand-accent underline inline-flex items-center gap-0.5">perplexity.ai/settings/api <ExternalLink size={10} /></a></li>
                    <li>2. Click <strong className="text-slate-300">Generate</strong> to create a new API key</li>
                    <li>3. Copy it and paste it below</li>
                  </ol>
                </div>

                <div>
                  <label className="label-dark">Perplexity API Key</label>
                  <div className="relative">
                    <Key size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      className="input-dark pl-10 pr-10 font-mono text-xs"
                      placeholder="pplx-xxxxxxxxxxxxxxxx"
                      autoFocus
                    />
                    <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                      {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5">We'll verify this key works before saving it.</p>
                </div>

                <button
                  onClick={handleSaveAI}
                  disabled={loading || !apiKey.trim() || keyVerified}
                  className={clsx('w-full justify-center mt-5 py-3', keyVerified ? 'btn-accent' : 'btn-primary')}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {loading ? (
                    <><Loader2 size={15} className="animate-spin" />Verifying key...</>
                  ) : keyVerified ? (
                    <><CheckCircle2 size={15} />Key verified — continuing...</>
                  ) : (
                    <>Verify & Save Key <ArrowRight size={15} /></>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3 — Done */}
          {step === 3 && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <div className="card-dark p-8 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                  className="w-16 h-16 rounded-full bg-green-900/30 border border-green-800/50 flex items-center justify-center mx-auto mb-5"
                >
                  <CheckCircle2 size={32} className="text-green-400" />
                </motion.div>

                <h2 className="font-heading text-xl font-bold text-white mb-2">You're all set.</h2>
                <p className="text-slate-400 text-sm mb-8">
                  Your account is created and the AI is connected. You'll enter your OneTrust credentials inside the app when you start your first implementation.
                </p>

                <div className="grid grid-cols-3 gap-3 mb-8 text-xs">
                  {[
                    { icon: <User size={16} />, label: 'Account', status: 'Created', color: 'text-green-400' },
                    { icon: <Brain size={16} />, label: 'AI', status: 'Connected', color: 'text-green-400' },
                    { icon: <Shield size={16} />, label: 'OneTrust', status: 'Set up inside', color: 'text-brand-primary' },
                  ].map(item => (
                    <div key={item.label} className="p-3 rounded-xl bg-white/3 border border-white/5">
                      <div className={clsx('mb-1', item.color)}>{item.icon}</div>
                      <div className="text-slate-400 font-medium">{item.label}</div>
                      <div className={clsx('text-[11px] mt-0.5', item.color)}>{item.status}</div>
                    </div>
                  ))}
                </div>

                <button onClick={handleFinish} disabled={loading} className="btn-primary w-full justify-center py-3 text-base">
                  {loading ? <><Loader2 size={15} className="animate-spin" />Opening app...</> : <>Open ZEROTRUST AI <ArrowRight size={16} /></>}
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
