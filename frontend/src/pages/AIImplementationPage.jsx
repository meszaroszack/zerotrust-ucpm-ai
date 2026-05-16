import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Upload, FileText, MessageSquare, Sparkles, CheckCircle2,
  AlertTriangle, AlertCircle, ArrowRight, ChevronDown, ChevronUp,
  Loader2, Info
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import {
  uploadDocument, aiIntakeDocument, aiAskFollowups,
  aiExtractProgram, aiGenerateScenarios, aiRecommendPurposes,
  aiRecommendDataElements, aiRecommendCollectionPoints
} from '../utils/api';
import { useAppStore } from '../store/appStore';
import { clsx } from 'clsx';

const PHASES = ['intake', 'followup', 'blueprint', 'approve'];
const SESSION_KEY = 'zt_planner_session';

// ---------------------------------------------------------------------------
// sessionStorage helpers — persist planner state across hard refreshes
// ---------------------------------------------------------------------------
function saveSession(data) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch {}
}
function loadSession() {
  try { const raw = sessionStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch {}
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function ConfidenceBadge({ level }) {
  const cls = { high: 'confidence-high', medium: 'confidence-medium', low: 'confidence-low' };
  return <span className={clsx('badge border text-[10px]', cls[level] || cls.medium)}>{level} confidence</span>;
}

function AICard({ result, onApprove }) {
  const [expanded, setExpanded] = useState(false);
  if (!result) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card-dark border-brand-accent/20 border overflow-hidden">
      <div className="p-4 border-b border-white/5 flex items-center gap-3">
        <Sparkles size={15} className="text-brand-accent" />
        <div className="flex-1">
          <div className="font-heading font-semibold text-white text-sm">{result.title || 'AI Analysis'}</div>
          <div className="text-xs text-slate-500 mt-0.5">{result.summary?.slice(0, 120)}...</div>
        </div>
        <ConfidenceBadge level={result.confidence} />
      </div>

      {result.warnings?.length > 0 && (
        <div className="px-4 py-2 bg-amber-950/30 border-b border-amber-900/20 flex items-center gap-2">
          <AlertTriangle size={12} className="text-amber-500" />
          <span className="text-xs text-amber-400">{result.warnings[0]}</span>
          {result.warnings.length > 1 && <span className="text-xs text-amber-600">+{result.warnings.length - 1} more</span>}
        </div>
      )}

      <div className="p-4">
        {result.recommendations?.length > 0 && (
          <div className="mb-3">
            <div className="section-header">Recommendations</div>
            <ul className="space-y-1">
              {result.recommendations.slice(0, expanded ? 999 : 3).map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                  <CheckCircle2 size={12} className="text-brand-accent mt-0.5 flex-shrink-0" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.humanReviewFlags?.length > 0 && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-950/30 border border-blue-900/20 text-xs text-blue-400">
            <Info size={12} className="flex-shrink-0" />
            <span>Human Review Required: {result.humanReviewFlags.slice(0, 2).join(' · ')}</span>
          </div>
        )}

        <div className="flex items-center justify-between mt-3">
          <button onClick={() => setExpanded(!expanded)} className="btn-ghost text-xs">
            {expanded ? <><ChevronUp size={13} />Less</> : <><ChevronDown size={13} />More details</>}
          </button>
          {onApprove && (
            <button onClick={onApprove} className="btn-accent text-xs py-1.5 px-4">
              Approve & Continue <ArrowRight size={13} />
            </button>
          )}
        </div>

        {expanded && result.proposedObjects?.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-2">
            <div className="section-header">Proposed Objects</div>
            {result.proposedObjects.map((obj, i) => (
              <div key={i} className="p-2.5 rounded-lg bg-white/3 border border-white/6 text-xs">
                <div className="font-medium text-white mb-0.5">{obj.name}</div>
                <div className="text-slate-500">{obj.description}</div>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function FollowupQuestions({ questions, answers, onChange, onSubmit, loading }) {
  return (
    <div className="card-dark p-5">
      <div className="flex items-center gap-2 mb-5">
        <MessageSquare size={16} className="text-brand-primary" />
        <h3 className="font-heading font-semibold text-white">Expert Follow-up Questions</h3>
        <span className="text-xs text-slate-500 ml-auto">{questions.length} questions</span>
      </div>
      <div className="space-y-4">
        {questions.map((q) => (
          <div key={q.id} className="border-b border-white/5 pb-4 last:border-0">
            <label className="block text-sm font-medium text-white mb-1">
              {q.question}
              {q.required && <span className="text-brand-error ml-1">*</span>}
            </label>
            <div className="text-xs text-slate-500 mb-2">{q.helpText}</div>
            {q.options?.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => onChange(q.id, opt)}
                    className={clsx('px-3 py-1.5 rounded-lg text-xs border transition-all', {
                      'bg-brand-primary/15 border-brand-primary/40 text-brand-primary': answers[q.id] === opt,
                      'bg-white/3 border-white/10 text-slate-400 hover:border-white/20': answers[q.id] !== opt
                    })}
                  >{opt}</button>
                ))}
              </div>
            ) : (
              <input
                type="text"
                value={answers[q.id] || ''}
                onChange={e => onChange(q.id, e.target.value)}
                className="input-dark text-sm"
                placeholder="Your answer..."
              />
            )}
          </div>
        ))}
      </div>
      <button onClick={onSubmit} disabled={loading} className="btn-primary w-full justify-center mt-4">
        {loading ? <><Loader2 size={15} className="animate-spin" />Generating Blueprint...</> : <>Generate Implementation Blueprint <Sparkles size={15} /></>}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function AIImplementationPage() {
  const { workspace } = useAppStore();

  // All planner state — initialized from sessionStorage if available
  const [phase, setPhase] = useState('intake');
  const [intakeText, setIntakeText] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [intakeResult, setIntakeResult] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [blueprint, setBlueprint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [pageError, setPageError] = useState('');

  // ── Rehydrate from sessionStorage on first mount ──────────────────────────
  useEffect(() => {
    const saved = loadSession();
    if (!saved) return;
    if (saved.phase) setPhase(saved.phase);
    if (saved.intakeText) setIntakeText(saved.intakeText);
    if (saved.uploadedFile) setUploadedFile(saved.uploadedFile);
    if (saved.intakeResult) setIntakeResult(saved.intakeResult);
    if (saved.questions?.length) setQuestions(saved.questions);
    if (saved.answers) setAnswers(saved.answers);
    if (saved.blueprint) setBlueprint(saved.blueprint);
  }, []);

  // ── Persist key state to sessionStorage whenever it changes ──────────────
  useEffect(() => {
    saveSession({ phase, intakeText, uploadedFile, intakeResult, questions, answers, blueprint });
  }, [phase, intakeText, uploadedFile, intakeResult, questions, answers, blueprint]);

  // ── File drop ─────────────────────────────────────────────────────────────
  const onDrop = useCallback(async (files) => {
    const file = files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('document', file);
    setLoading(true); setLoadingMsg('Extracting document...'); setPageError('');
    try {
      const r = await uploadDocument(fd);
      setUploadedFile(r.data.file);
      setIntakeText(r.data.file.extractedText || '');
    } catch (e) {
      setPageError('Upload failed: ' + (e.response?.data?.error || e.message));
    } finally { setLoading(false); }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'application/pdf': [], 'text/plain': [] }, maxFiles: 1
  });

  // ── Intake ────────────────────────────────────────────────────────────────
  const handleIntake = async () => {
    if (!intakeText.trim()) return;
    setLoading(true); setLoadingMsg('AI is analyzing your requirements...'); setPageError('');
    try {
      const r = await aiIntakeDocument({ content: intakeText, filename: uploadedFile?.originalName });
      setIntakeResult(r.data);
    } catch (e) {
      setPageError(e.response?.data?.error || 'AI analysis failed. Please try again.');
    } finally { setLoading(false); }
  };

  // ── Followups — fixed ─────────────────────────────────────────────────────
  const handleFollowups = async () => {
    setLoading(true); setLoadingMsg('Generating expert follow-up questions...'); setPageError('');
    // Move to followup phase immediately so the user sees a loading state there
    setPhase('followup');
    try {
      const ctx = { ...intakeResult, brandName: workspace?.activeBrandName };
      const r = await aiAskFollowups({ context: ctx });

      // Backend returns the parsed AI object directly: { questions: [...], title, summary, ... }
      // Normalise: accept both r.data.questions and r.data itself being an array
      const payload = r.data;
      const qs = Array.isArray(payload?.questions)
        ? payload.questions
        : Array.isArray(payload)
        ? payload
        : null;

      if (!qs || qs.length === 0) {
        setPageError(
          'AI returned no follow-up questions. ' +
          (payload?.summary ? `AI said: "${payload.summary}"` : 'The response may be malformed — check Railway logs.')
        );
        // Stay on followup so the error renders; don't spin forever
        setQuestions([]);
        return;
      }

      setQuestions(qs);
      setPageError('');
    } catch (e) {
      setPageError(e.response?.data?.error || e.message || 'Could not generate questions. Please try again.');
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Blueprint ─────────────────────────────────────────────────────────────
  const handleGenerateBlueprint = async () => {
    setLoading(true); setLoadingMsg('Building implementation blueprint...'); setPageError('');
    try {
      const ctx = { ...intakeResult, answers, brandName: workspace?.activeBrandName };
      const [prog, scenarios, purposes, elements, cps] = await Promise.allSettled([
        aiExtractProgram({ context: ctx }),
        aiGenerateScenarios({ context: ctx }),
        aiRecommendPurposes({ context: ctx }),
        aiRecommendDataElements({ context: ctx }),
        aiRecommendCollectionPoints({ context: ctx }),
      ]);
      const bp = {
        program:          prog.status      === 'fulfilled' ? prog.value.data      : null,
        scenarios:        scenarios.status === 'fulfilled' ? scenarios.value.data : null,
        purposes:         purposes.status  === 'fulfilled' ? purposes.value.data  : null,
        dataElements:     elements.status  === 'fulfilled' ? elements.value.data  : null,
        collectionPoints: cps.status       === 'fulfilled' ? cps.value.data       : null,
      };
      setBlueprint(bp);
      setPhase('blueprint');
    } catch (e) {
      setPageError(e.response?.data?.error || 'Blueprint generation failed. Please try again.');
    } finally { setLoading(false); }
  };

  // ── Reset planner ─────────────────────────────────────────────────────────
  const handleReset = () => {
    clearSession();
    setPhase('intake'); setIntakeText(''); setUploadedFile(null);
    setIntakeResult(null); setQuestions([]); setAnswers({});
    setBlueprint(null); setLoading(false); setPageError('');
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-brand-accent text-xs font-mono mb-2 uppercase tracking-widest">
            <Brain size={12} /><span>AI Implementation Officer</span>
          </div>
          <h1 className="font-heading text-3xl font-bold text-white">Implementation Planner</h1>
          <p className="text-slate-500 text-sm mt-1">
            Upload requirements, answer questions, approve blueprint — AI handles the OneTrust object strategy.
          </p>
        </div>
        {phase !== 'intake' && (
          <button onClick={handleReset} className="btn-ghost text-xs mt-1 flex-shrink-0">
            Start over
          </button>
        )}
      </div>

      {/* Phase tabs */}
      <div className="flex gap-1 p-1 bg-white/3 rounded-xl mb-6 border border-white/5">
        {PHASES.map((p, i) => (
          <button
            key={p}
            onClick={() => i <= PHASES.indexOf(phase) && setPhase(p)}
            className={clsx('flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all capitalize', {
              'bg-brand-primary text-white shadow': p === phase,
              'text-slate-500 hover:text-slate-300': p !== phase && i <= PHASES.indexOf(phase),
              'text-slate-700 cursor-not-allowed': i > PHASES.indexOf(phase)
            })}
          >
            {p}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ── Intake Phase ── */}
        {phase === 'intake' && (
          <motion.div key="intake" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div
              {...getRootProps()}
              className={clsx(
                'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
                isDragActive ? 'border-brand-primary bg-brand-primary/5' : 'border-white/10 hover:border-white/20 bg-white/2'
              )}
            >
              <input {...getInputProps()} />
              <Upload size={24} className="mx-auto mb-3 text-slate-500" />
              <div className="text-sm font-medium text-white mb-1">
                {isDragActive ? 'Drop it here' : 'Upload Implementation Plan'}
              </div>
              <div className="text-xs text-slate-500">PDF, TXT — or paste text below</div>
              {uploadedFile && (
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-950/50 border border-green-800/50 text-green-400 text-xs">
                  <FileText size={12} />{uploadedFile.originalName}
                </div>
              )}
            </div>

            <div>
              <label className="label-dark">Or paste requirements / plain English description</label>
              <textarea
                value={intakeText}
                onChange={e => setIntakeText(e.target.value)}
                className="input-dark min-h-36 resize-none font-mono text-xs"
                placeholder={`Example:\n"We are a B2B SaaS company serving customers in Germany, UK, and California. We collect email, company name, and job title for marketing. We run Google Analytics and Meta Pixel..."`}
              />
            </div>

            {pageError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-red-400 text-sm">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                <span>{pageError}</span>
              </div>
            )}

            {intakeResult && <AICard result={intakeResult} />}

            <div className="flex gap-3">
              <button onClick={handleIntake} disabled={loading || !intakeText} className="btn-primary flex-1 justify-center">
                {loading
                  ? <><Loader2 size={15} className="animate-spin" />{loadingMsg}</>
                  : <><Brain size={15} />Analyze with AI</>}
              </button>
              {intakeResult && (
                <button onClick={handleFollowups} disabled={loading} className="btn-accent">
                  Continue <ArrowRight size={15} />
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Followup Phase ── */}
        {phase === 'followup' && (
          <motion.div key="followup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">

            {/* Error banner — shown when payload is bad or request failed */}
            {pageError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/50 border border-red-900/50 text-red-400 text-sm">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span>{pageError}</span>
                  <button onClick={handleFollowups} className="block mt-2 text-xs underline text-red-300 hover:text-red-100">
                    Retry
                  </button>
                </div>
              </div>
            )}

            {/* Loading state — only shown while request in flight AND no questions yet */}
            {loading && questions.length === 0 && !pageError && (
              <div className="card-dark p-6 text-center">
                <Loader2 size={24} className="animate-spin text-brand-primary mx-auto mb-3" />
                <p className="text-slate-400 text-sm">{loadingMsg || 'Generating questions...'}</p>
              </div>
            )}

            {/* Questions — shown once we have them */}
            {!loading && questions.length > 0 && !pageError && (
              <FollowupQuestions
                questions={questions}
                answers={answers}
                onChange={(id, val) => setAnswers(a => ({ ...a, [id]: val }))}
                onSubmit={handleGenerateBlueprint}
                loading={loading}
              />
            )}

            {/* Edge case: request finished, no error, no questions */}
            {!loading && questions.length === 0 && !pageError && (
              <div className="card-dark p-6 text-center">
                <AlertTriangle size={24} className="text-amber-500 mx-auto mb-3" />
                <p className="text-slate-400 text-sm mb-3">No questions were returned. You can retry or skip to blueprint.</p>
                <div className="flex gap-3 justify-center">
                  <button onClick={handleFollowups} className="btn-secondary text-xs">Retry</button>
                  <button onClick={handleGenerateBlueprint} disabled={loading} className="btn-accent text-xs">
                    Skip to Blueprint <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Blueprint Phase ── */}
        {phase === 'blueprint' && blueprint && (
          <motion.div key="blueprint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="card-dark p-5 border-brand-primary/20 border">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={16} className="text-brand-primary" />
                <h3 className="font-heading font-semibold text-white">Implementation Blueprint</h3>
                <span className="badge bg-brand-primary/10 border-brand-primary/30 text-brand-primary text-[10px] ml-auto">AI-Generated</span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'Purposes',         count: blueprint.purposes?.proposedObjects?.length || 0 },
                  { label: 'Data Elements',    count: blueprint.dataElements?.proposedObjects?.length || 0 },
                  { label: 'Scenarios',        count: blueprint.scenarios?.scenarios?.length || 0 },
                  { label: 'Collection Points',count: blueprint.collectionPoints?.proposedObjects?.length || 0 },
                ].map((s) => (
                  <div key={s.label} className="p-3 rounded-lg bg-white/3 border border-white/6 text-center">
                    <div className="text-2xl font-heading font-bold text-white">{s.count}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-950/30 border border-blue-900/20 text-xs text-blue-400 mb-4">
                <Info size={12} />
                <span>This is a regulatory-informed implementation recommendation. Human review required before production deployment.</span>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setPhase('followup')} className="btn-secondary">Revise Questions</button>
                <button onClick={() => setPhase('approve')} className="btn-accent flex-1 justify-center">
                  Review & Approve <ArrowRight size={15} />
                </button>
              </div>
            </div>

            {blueprint.purposes?.proposedObjects?.length > 0 && (
              <div className="card-dark p-4">
                <div className="section-header">Recommended Purposes</div>
                <div className="space-y-2">
                  {blueprint.purposes.proposedObjects.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-white/3 border border-white/6">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">{p.name}</div>
                        <div className="text-xs text-slate-500">{p.legalBasis}</div>
                      </div>
                      <ConfidenceBadge level={p.confidenceScore > 0.7 ? 'high' : p.confidenceScore > 0.4 ? 'medium' : 'low'} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Approve Phase ── */}
        {phase === 'approve' && (
          <motion.div key="approve" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card-dark p-6 text-center">
            <CheckCircle2 size={48} className="text-brand-accent mx-auto mb-4" />
            <h3 className="font-heading text-xl font-bold text-white mb-2">Blueprint Approved</h3>
            <p className="text-slate-500 text-sm mb-6">
              Your implementation model has been saved to the active workspace. Proceed to create OneTrust objects.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => { clearSession(); window.location.href = '/purposes'; }} className="btn-primary">
                Go to Purposes &amp; Data
              </button>
              <button onClick={() => { clearSession(); window.location.href = '/scenarios'; }} className="btn-accent">
                Go to Scenario Studio
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
