import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Key, Brain, Shield, User, CheckCircle2, AlertCircle,
  Loader2, Eye, EyeOff, Save, ExternalLink, Zap, Lock, Info
} from 'lucide-react';
import { saveAIKey, saveAdminAccount, saveOTCredentials } from '../utils/api';
import { useAppStore } from '../store/appStore';
import { clsx } from 'clsx';

const TABS = [
  { id: 'ai', label: 'AI Settings', icon: Brain },
  { id: 'account', label: 'My Account', icon: User },
  { id: 'onetrust', label: 'OneTrust', icon: Shield },
];

function SaveButton({ loading, saved, onClick, label = 'Save Changes' }) {
  return (
    <button onClick={onClick} disabled={loading || saved} className={clsx('btn-primary', saved && 'bg-green-700 hover:bg-green-700')}>
      {loading ? <><Loader2 size={15} className="animate-spin" />Saving...</> :
       saved ? <><CheckCircle2 size={15} />Saved</> :
       <><Save size={15} />{label}</>}
    </button>
  );
}

function FieldRow({ label, hint, children }) {
  return (
    <div>
      <label className="label-dark">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-600 mt-1.5">{hint}</p>}
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('ai');
  const { user } = useAppStore();

  // AI tab state
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSaved, setAiSaved] = useState(false);
  const [aiError, setAiError] = useState('');

  // Account tab state
  const [newEmail, setNewEmail] = useState(user?.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountSaved, setAccountSaved] = useState(false);
  const [accountError, setAccountError] = useState('');

  // OT tab state
  const [otBaseUrl, setOtBaseUrl] = useState('https://app.onetrust.com');
  const [otClientId, setOtClientId] = useState('');
  const [otClientSecret, setOtClientSecret] = useState('');
  const [showOtSecret, setShowOtSecret] = useState(false);
  const [otLoading, setOtLoading] = useState(false);
  const [otSaved, setOtSaved] = useState(false);
  const [otError, setOtError] = useState('');

  const handleSaveAI = async () => {
    if (!apiKey.trim()) { setAiError('Please enter your API key.'); return; }
    setAiLoading(true); setAiError('');
    try {
      await saveAIKey({ perplexityApiKey: apiKey.trim() });
      setAiSaved(true);
      setTimeout(() => setAiSaved(false), 3000);
    } catch (e) {
      setAiError(e.response?.data?.error || 'That key did not work. Please check it and try again.');
    } finally { setAiLoading(false); }
  };

  const handleSaveAccount = async () => {
    if (!newEmail) { setAccountError('Email is required.'); return; }
    if (newPassword && newPassword !== confirmPassword) { setAccountError('Passwords do not match.'); return; }
    if (newPassword && newPassword.length < 8) { setAccountError('Password must be at least 8 characters.'); return; }
    setAccountLoading(true); setAccountError('');
    try {
      await saveAdminAccount({ email: newEmail, password: newPassword || undefined });
      setAccountSaved(true);
      setTimeout(() => setAccountSaved(false), 3000);
    } catch (e) {
      setAccountError(e.response?.data?.error || 'Could not update your account.');
    } finally { setAccountLoading(false); }
  };

  const handleSaveOT = async () => {
    setOtLoading(true); setOtError('');
    try {
      await saveOTCredentials({ otBaseUrl, otClientId, otClientSecret, otParentOrgName: 'Meszaros - Do Not Touch' });
      setOtSaved(true);
      setTimeout(() => setOtSaved(false), 3000);
    } catch (e) {
      setOtError(e.response?.data?.error || 'Could not save OneTrust credentials.');
    } finally { setOtLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-slate-500 text-xs font-mono mb-2 uppercase tracking-widest">
          <Settings size={12} /><span>Configuration</span>
        </div>
        <h1 className="font-heading text-3xl font-bold text-white">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your AI connection, account, and OneTrust credentials.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/3 rounded-xl mb-6 border border-white/5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={clsx('flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all', {
              'bg-brand-primary text-white shadow': t.id === activeTab,
              'text-slate-500 hover:text-white': t.id !== activeTab
            })}>
            <t.icon size={13} />{t.label}
          </button>
        ))}
      </div>

      {/* AI Settings */}
      {activeTab === 'ai' && (
        <motion.div key="ai" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="card-dark p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-brand-accent/15 flex items-center justify-center">
                <Brain size={20} className="text-brand-accent" />
              </div>
              <div>
                <div className="font-heading font-semibold text-white">Perplexity AI</div>
                <div className="text-xs text-slate-500">Powers all analysis, scenario generation, and recommendations</div>
              </div>
              <div className="ml-auto">
                <span className="badge bg-green-950 border-green-800 text-green-400 text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block mr-1" />
                  Active
                </span>
              </div>
            </div>

            {aiError && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-red-400 text-sm mb-4">
                <AlertCircle size={14} />{aiError}
              </div>
            )}

            <FieldRow label="API Key" hint="Your key is stored securely on this server and never shared.">
              <div className="relative">
                <Key size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  className="input-dark pl-10 pr-10 font-mono text-xs"
                  placeholder="Enter new key to replace current"
                />
                <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </FieldRow>

            <div className="flex items-center justify-between mt-5">
              <a href="https://www.perplexity.ai/settings/api" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-brand-accent hover:underline">
                Get a Perplexity API key <ExternalLink size={11} />
              </a>
              <SaveButton loading={aiLoading} saved={aiSaved} onClick={handleSaveAI} label="Save & Verify Key" />
            </div>
          </div>

          {/* Future providers info card */}
          <div className="card-dark p-4 opacity-60">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} className="text-slate-500" />
              <span className="text-xs font-medium text-slate-500">Additional AI Providers — Coming Soon</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {['OpenAI', 'Anthropic Claude', 'Google Gemini', 'Azure OpenAI', 'AWS Bedrock'].map(p => (
                <span key={p} className="px-2.5 py-1 rounded-lg text-[11px] bg-white/3 border border-white/5 text-slate-600">{p}</span>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Account */}
      {activeTab === 'account' && (
        <motion.div key="account" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-dark p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/15 flex items-center justify-center">
              <User size={20} className="text-brand-primary" />
            </div>
            <div>
              <div className="font-heading font-semibold text-white">Your Account</div>
              <div className="text-xs text-slate-500">Update your sign-in credentials</div>
            </div>
          </div>

          {accountError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-red-400 text-sm mb-4">
              <AlertCircle size={14} />{accountError}
            </div>
          )}

          <div className="space-y-4">
            <FieldRow label="Email Address">
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} className="input-dark" />
            </FieldRow>

            <FieldRow label="New Password" hint="Leave blank to keep your current password.">
              <div className="relative">
                <input type={showNewPass ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} className="input-dark pr-10" placeholder="New password (optional)" />
                <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                  {showNewPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </FieldRow>

            {newPassword && (
              <FieldRow label="Confirm New Password">
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="input-dark" placeholder="Type new password again" />
              </FieldRow>
            )}
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-white/3 border border-white/5 text-xs text-slate-500 mt-5 mb-5">
            <Lock size={12} className="text-brand-primary flex-shrink-0" />
            Changes take effect on your next sign-in.
          </div>

          <div className="flex justify-end">
            <SaveButton loading={accountLoading} saved={accountSaved} onClick={handleSaveAccount} />
          </div>
        </motion.div>
      )}

      {/* OneTrust */}
      {activeTab === 'onetrust' && (
        <motion.div key="onetrust" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-dark p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-brand-gold/15 flex items-center justify-center">
              <Shield size={20} className="text-brand-gold" />
            </div>
            <div>
              <div className="font-heading font-semibold text-white">OneTrust Connection</div>
              <div className="text-xs text-slate-500">Default credentials used when starting new implementations</div>
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-brand-primary/5 border border-brand-primary/15 text-xs text-slate-400 mb-5">
            <Info size={12} className="text-brand-primary mt-0.5 flex-shrink-0" />
            <span>You can also enter credentials fresh each time you start a new implementation — these are just defaults to save you time.</span>
          </div>

          {otError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-red-400 text-sm mb-4">
              <AlertCircle size={14} />{otError}
            </div>
          )}

          <div className="space-y-4">
            <FieldRow label="OneTrust URL">
              <input value={otBaseUrl} onChange={e => setOtBaseUrl(e.target.value)} className="input-dark font-mono text-xs" />
            </FieldRow>
            <FieldRow label="Client ID" hint="Found in your OneTrust OAuth application settings.">
              <input value={otClientId} onChange={e => setOtClientId(e.target.value)} className="input-dark font-mono text-xs" placeholder="your-client-id" />
            </FieldRow>
            <FieldRow label="Client Secret">
              <div className="relative">
                <input type={showOtSecret ? 'text' : 'password'} value={otClientSecret} onChange={e => setOtClientSecret(e.target.value)} className="input-dark font-mono text-xs pr-10" placeholder="your-client-secret" />
                <button type="button" onClick={() => setShowOtSecret(!showOtSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                  {showOtSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </FieldRow>
          </div>

          <div className="flex justify-end mt-5">
            <SaveButton loading={otLoading} saved={otSaved} onClick={handleSaveOT} />
          </div>
        </motion.div>
      )}
    </div>
  );
}
