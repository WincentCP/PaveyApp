import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, ChevronUp,
  Diamond, Eye, EyeOff, Flame, GripVertical, Lock,
  Mail, MapPin, Palmtree, Plus, Sparkles, User, X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import type { Vibe } from '../data/places';

type AuthMode = 'signup' | 'login';
type Step =
  | 'welcome'
  | 'auth_form'
  | 'vibe'
  | 'destinations'
  | 'dates'
  | 'budget'
  | 'interests'
  | 'location';

const VIBES: { id: Vibe; label: string; emoji: string; desc: string }[] = [
  { id: 'chill', label: 'Chill', emoji: '🌴', desc: 'Relaxed beaches & slow mornings' },
  { id: 'chaos', label: 'Chaos', emoji: '🔥', desc: 'Full days & hidden street food' },
  { id: 'zen', label: 'Zen', emoji: '🧘', desc: 'Temples, nature & mindful walks' },
  { id: 'luxury', label: 'Luxury', emoji: '💎', desc: 'Boutique stays & fine dining' },
];

const INTEREST_OPTIONS = [
  { label: 'Coffee', emoji: '☕' }, { label: 'Beaches', emoji: '🏖️' },
  { label: 'History', emoji: '🏛️' }, { label: 'Art', emoji: '🎨' },
  { label: 'Street Food', emoji: '🍜' }, { label: 'Shopping', emoji: '🛍️' },
  { label: 'Hiking', emoji: '🥾' }, { label: 'Photography', emoji: '📷' },
  { label: 'Nightlife', emoji: '🌃' }, { label: 'Wellness', emoji: '🧖' },
  { label: 'Architecture', emoji: '🏙️' }, { label: 'Local Markets', emoji: '🏪' },
];

const FLOW: Step[] = ['welcome', 'auth_form', 'vibe', 'destinations', 'dates', 'budget', 'interests', 'location'];
const PROGRESS_STEPS: Step[] = ['vibe', 'destinations', 'dates', 'budget', 'interests', 'location'];

export default function OnboardingPage() {
  const nav = useNavigate();
  const { completeOnboarding, onboardingComplete } = useApp();

  // Skip onboarding if already authenticated
  useEffect(() => {
    if (onboardingComplete) nav('/', { replace: true });
  }, [onboardingComplete, nav]);

  const [step, setStep] = useState<Step>('welcome');
  const [authMode, setAuthMode] = useState<AuthMode>('signup');

  // Auth form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [authErrors, setAuthErrors] = useState<Record<string, string>>({});
  const [authLoading, setAuthLoading] = useState(false);

  // Onboarding state
  const [selectedVibe, setSelectedVibe] = useState<Vibe>('zen');
  const [destInput, setDestInput] = useState('');
  const [destList, setDestList] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [calPhase, setCalPhase] = useState<'start' | 'end'>('start');
  const [budget, setBudget] = useState(500_000);
  const [interests, setInterests] = useState<string[]>([]);
  const [locationGranted, setLocationGranted] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);

  const destInputRef = useRef<HTMLInputElement>(null);

  const totalDays = useMemo(() => {
    if (!startDate || !endDate) return 1;
    return Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1);
  }, [startDate, endDate]);

  const progressIdx = PROGRESS_STEPS.indexOf(step);

  const validateAuth = (): boolean => {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Invalid email format';
    if (!password) errs.password = 'Password is required';
    else if (password.length < 6) errs.password = 'Minimum 6 characters';
    if (authMode === 'signup') {
      if (!name.trim()) errs.name = 'Name is required';
      if (!confirmPassword) errs.confirmPassword = 'Please confirm your password';
      else if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    }
    setAuthErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAuthSubmit = () => {
    if (!validateAuth()) return;
    setAuthLoading(true);
    setTimeout(() => {
      setAuthLoading(false);
      go('vibe');
    }, 1200);
  };

  const handleFinish = () => {
    const startStr = startDate
      ? `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
      : 'today';
    completeOnboarding({
      name: authMode === 'signup' ? name : (name || 'Traveler'),
      email,
      vibe: selectedVibe,
      destinations: destList.length > 0
        ? destList.map((d) => ({ name: d, days: Math.max(1, Math.floor(totalDays / Math.max(1, destList.length))) }))
        : [{ name: 'My Destination', days: totalDays }],
      totalDays,
      budget,
      startDate: startStr,
    });
    nav('/');
  };

  const go = (s: Step) => setStep(s);
  const back = () => {
    const idx = FLOW.indexOf(step);
    if (idx > 0) setStep(FLOW[idx - 1]);
  };

  const handleCalSelect = (d: Date) => {
    if (calPhase === 'start') {
      setStartDate(d); setEndDate(null); setCalPhase('end');
    } else {
      if (startDate && d < startDate) { setStartDate(d); setEndDate(null); }
      else setEndDate(d);
    }
  };

  const addDest = () => {
    const val = destInput.trim();
    if (!val || destList.includes(val)) return;
    setDestList((prev) => [...prev, val]);
    setDestInput('');
    destInputRef.current?.focus();
  };

  const removeDest = (i: number) => setDestList((prev) => prev.filter((_, idx) => idx !== i));
  const moveDest = (from: number, to: number) => {
    if (to < 0 || to >= destList.length) return;
    setDestList((prev) => {
      const next = prev.slice();
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const sliderPct = Math.max(0, Math.min(100, ((budget - 50_000) / (1_000_000 - 50_000)) * 100));
  const fmt = (n: number) =>
    n >= 1_000_000 ? `Rp ${(n / 1_000_000).toFixed(1)}jt` : `Rp ${Math.round(n / 1000)}K`;

  const slideVariants = {
    enter: { x: 40, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -40, opacity: 0 },
  };

  // ── Per-step CTA config ───────────────────────────────
  type CTAConfig = { label: string; onClick: () => void; disabled?: boolean; className?: string; skipLabel?: string; onSkip?: () => void };

  const ctaConfig: Partial<Record<Step, CTAConfig>> = {
    vibe: { label: 'Continue', onClick: () => go('destinations') },
    destinations: {
      label: 'Continue',
      onClick: () => { if (destList.length === 0) setDestList(['My Destination']); go('dates'); },
    },
    dates: {
      label: startDate && endDate ? 'Continue' : 'Skip for now',
      onClick: () => { if (!startDate) setStartDate(new Date()); go('budget'); },
    },
    budget: { label: 'Continue', onClick: () => go('interests') },
    interests: {
      label: 'Continue',
      onClick: () => go('location'),
      skipLabel: 'Skip',
      onSkip: () => go('location'),
    },
    location: {
      label: locationGranted ? 'Start exploring →' : 'Continue without location',
      onClick: handleFinish,
      className: locationGranted ? 'bg-emerald-500 text-white' : undefined,
    },
  };

  const cta = ctaConfig[step];

  return (
    <div className="absolute inset-0 bg-white flex flex-col overflow-hidden">
      <AnimatePresence mode="wait">

        {/* ── WELCOME ── */}
        {step === 'welcome' && (
          <motion.div
            key="welcome"
            variants={slideVariants} initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 flex flex-col"
          >
            <div className="relative flex-1 flex flex-col bg-brand-500">
              <div className="absolute top-[-80px] right-[-60px] w-64 h-64 rounded-full bg-white/5" />
              <div className="absolute top-[60px] left-[-40px] w-40 h-40 rounded-full bg-white/5" />

              <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 text-center">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 260, damping: 20 }}
                  className="w-24 h-24 rounded-3xl bg-white flex items-center justify-center mb-6 shadow-xl"
                >
                  <span className="text-5xl">✈️</span>
                </motion.div>
                <motion.h1
                  initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.35 }}
                  className="text-4xl font-extrabold text-white font-display leading-tight"
                >
                  Plan smarter.<br />Travel better.
                </motion.h1>
                <motion.p
                  initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.45 }}
                  className="mt-3 text-white/80 text-base leading-relaxed"
                >
                  AI-powered trip planning that adapts to your style — from multi-city adventures to weekend escapes.
                </motion.p>
              </div>

              <motion.div
                initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.55, type: 'spring', stiffness: 280, damping: 30 }}
                className="relative z-10 bg-white rounded-t-3xl px-6 pt-6 pb-10"
              >
                <button
                  onClick={() => { setAuthMode('signup'); go('auth_form'); }}
                  className="w-full h-14 rounded-2xl bg-brand-500 text-white font-bold text-base press shadow-glow flex items-center justify-center gap-2 mb-3"
                >
                  <Sparkles className="w-5 h-5" /> Get Started — it's free
                </button>
                <button
                  onClick={() => { setAuthMode('login'); go('auth_form'); }}
                  className="w-full h-12 rounded-2xl bg-ink-50 text-ink-800 font-semibold text-base press flex items-center justify-center gap-2"
                >
                  I already have an account
                </button>
                <p className="text-center text-[11px] text-ink-400 mt-4 leading-relaxed">
                  By continuing you agree to our Terms &amp; Privacy Policy
                </p>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ── AUTH FORM ── */}
        {step === 'auth_form' && (
          <motion.div
            key="auth_form"
            variants={slideVariants} initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 flex flex-col"
          >
            {/* Back + title */}
            <div className="px-5 pt-12 pb-4 shrink-0">
              <button onClick={() => go('welcome')} className="mb-4 w-10 h-10 -ml-2 flex items-center justify-center text-ink-700 press">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-2xl font-extrabold text-ink-900 font-display">
                {authMode === 'signup' ? 'Create your account' : 'Welcome back'}
              </h2>
              <p className="text-sm text-ink-500 mt-1">
                {authMode === 'signup' ? 'Join thousands of smart travelers' : 'Sign in to continue your journey'}
              </p>
            </div>

            {/* Scrollable fields */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-5 space-y-4 pb-4">
              {authMode === 'signup' && (
                <FormField
                  label="Full Name" icon={<User className="w-4 h-4" />}
                  value={name} onChange={setName} placeholder="Your name" error={authErrors.name}
                />
              )}
              <FormField
                label="Email Address" icon={<Mail className="w-4 h-4" />}
                value={email} onChange={setEmail} placeholder="you@email.com"
                type="email" error={authErrors.email}
              />
              <div>
                <div className="text-[10px] font-bold tracking-widest text-ink-500 mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> PASSWORD
                </div>
                <div className={`flex items-center gap-3 bg-ink-50 rounded-xl px-3 py-3 border-2 transition-colors ${authErrors.password ? 'border-red-400' : 'border-transparent focus-within:border-brand-400'}`}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none"
                  />
                  <button onClick={() => setShowPw((v) => !v)} className="press text-ink-400">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {authErrors.password && <p className="text-xs text-red-500 mt-1">{authErrors.password}</p>}
              </div>
              {authMode === 'signup' && (
                <div>
                  <div className="text-[10px] font-bold tracking-widest text-ink-500 mb-1.5">CONFIRM PASSWORD</div>
                  <input
                    type="password" value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className={`w-full bg-ink-50 rounded-xl px-3 py-3 text-sm text-ink-900 placeholder:text-ink-400 outline-none border-2 transition-colors ${authErrors.confirmPassword ? 'border-red-400' : 'border-transparent focus:border-brand-400'}`}
                  />
                  {authErrors.confirmPassword && <p className="text-xs text-red-500 mt-1">{authErrors.confirmPassword}</p>}
                </div>
              )}
            </div>

            {/* Fixed bottom CTA */}
            <div className="px-5 pt-3 pb-8 bg-white shrink-0 border-t border-ink-50 space-y-2">
              <button
                onClick={handleAuthSubmit}
                disabled={authLoading}
                className="w-full h-14 rounded-2xl bg-brand-500 disabled:bg-brand-300 text-white font-bold text-base press shadow-glow flex items-center justify-center gap-2"
              >
                {authLoading ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                    <Sparkles className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <>{authMode === 'signup' ? 'Create Account' : 'Sign In'} <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
              <button
                onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')}
                className="w-full text-center text-sm text-ink-500 press py-2"
              >
                {authMode === 'signup'
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Sign up"}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── POST-AUTH STEPS ── */}
        {PROGRESS_STEPS.includes(step) && (
          <motion.div
            key={step}
            variants={slideVariants} initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* Progress bar */}
            <div className="px-5 pt-12 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={back} className="w-8 h-8 rounded-full bg-ink-50 flex items-center justify-center press shrink-0">
                  <ArrowLeft className="w-4 h-4 text-ink-700" />
                </button>
                <div className="flex-1 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-brand-500 rounded-full"
                    initial={false}
                    animate={{ width: `${((progressIdx + 1) / PROGRESS_STEPS.length) * 100}%` }}
                    transition={{ duration: 0.35 }}
                  />
                </div>
                <span className="text-xs text-ink-500 font-semibold shrink-0">
                  {progressIdx + 1}/{PROGRESS_STEPS.length}
                </span>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-4">

              {/* VIBE */}
              {step === 'vibe' && (
                <>
                  <StepTitle title="What's your travel vibe?" subtitle="This shapes every recommendation we make" />
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {VIBES.map((v) => {
                      const active = selectedVibe === v.id;
                      const Icon = v.id === 'chill' ? Palmtree : v.id === 'chaos' ? Flame : v.id === 'zen' ? Sparkles : Diamond;
                      return (
                        <motion.button
                          key={v.id} whileTap={{ scale: 0.96 }}
                          onClick={() => setSelectedVibe(v.id)}
                          className={`relative p-4 rounded-2xl border-2 text-left transition-colors press ${active ? 'border-brand-500 bg-brand-50' : 'border-ink-100 bg-white'}`}
                        >
                          {active && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                          <div className="text-3xl mb-2">{v.emoji}</div>
                          <Icon className="hidden" />
                          <div className="font-bold text-ink-900 font-display">{v.label}</div>
                          <div className="text-xs text-ink-500 mt-0.5 leading-snug">{v.desc}</div>
                        </motion.button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* DESTINATIONS */}
              {step === 'destinations' && (
                <>
                  <StepTitle title="Where are you headed?" subtitle="Add one or more destinations — in order" />
                  <div className="mt-4 flex gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-ink-50 rounded-xl px-3 py-2.5 border-2 border-transparent focus-within:border-brand-400 transition-colors">
                      <MapPin className="w-4 h-4 text-ink-400 shrink-0" />
                      <input
                        ref={destInputRef}
                        value={destInput}
                        onChange={(e) => setDestInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addDest()}
                        placeholder="City or country…"
                        className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 outline-none"
                      />
                    </div>
                    <button
                      onClick={addDest}
                      disabled={!destInput.trim()}
                      className="w-11 h-11 rounded-xl bg-brand-500 disabled:bg-ink-200 text-white flex items-center justify-center press shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {destList.length === 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {['Paris, France', 'Rome, Italy', 'Bali, Indonesia', 'Tokyo, Japan', 'Barcelona, Spain'].map((d) => (
                        <button
                          key={d}
                          onClick={() => setDestList((prev) => prev.includes(d) ? prev : [...prev, d])}
                          className="px-3 py-1.5 rounded-full bg-ink-50 text-ink-700 text-xs font-semibold press border border-ink-100"
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                  {destList.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <div className="text-[10px] font-bold tracking-widest text-ink-500 mb-1">YOUR ROUTE</div>
                      <AnimatePresence>
                        {destList.map((d, i) => (
                          <motion.div
                            key={d} layout
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex items-center gap-2 bg-white border border-ink-100 rounded-xl px-3 py-2.5"
                          >
                            <div className="w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                            <span className="flex-1 text-sm font-semibold text-ink-900">{d}</span>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button onClick={() => moveDest(i, i - 1)} disabled={i === 0} className="w-6 h-6 flex items-center justify-center text-ink-300 disabled:opacity-20 press">
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => moveDest(i, i + 1)} disabled={i === destList.length - 1} className="w-6 h-6 flex items-center justify-center text-ink-300 disabled:opacity-20 press">
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                              <GripVertical className="w-4 h-4 text-ink-200 mx-0.5" />
                              <button onClick={() => removeDest(i)} className="w-6 h-6 flex items-center justify-center text-ink-400 hover:text-red-500 press">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      {destList.length > 1 && (
                        <div className="flex items-center gap-2 py-1 px-2">
                          <div className="flex-1 h-px border-t border-dashed border-brand-200" />
                          <span className="text-[11px] text-brand-500 font-semibold shrink-0">Multi-city route ✈️</span>
                          <div className="flex-1 h-px border-t border-dashed border-brand-200" />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* DATES */}
              {step === 'dates' && (
                <>
                  <StepTitle title="When are you traveling?" subtitle="Pick your start and end dates" />
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`flex-1 py-2 px-3 rounded-xl text-center text-xs font-semibold border-2 transition-colors ${calPhase === 'start' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-100 bg-ink-50 text-ink-600'}`}>
                        <div className="text-[9px] text-ink-400 mb-0.5">DEPART</div>
                        {startDate ? startDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'Select'}
                      </div>
                      <span className="text-ink-300 font-bold">→</span>
                      <div className={`flex-1 py-2 px-3 rounded-xl text-center text-xs font-semibold border-2 transition-colors ${calPhase === 'end' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-100 bg-ink-50 text-ink-600'}`}>
                        <div className="text-[9px] text-ink-400 mb-0.5">RETURN</div>
                        {endDate ? endDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) : 'Select'}
                      </div>
                      {startDate && endDate && (
                        <div className="bg-brand-50 border-2 border-brand-100 rounded-xl px-3 py-2 text-center shrink-0">
                          <div className="text-[9px] text-brand-500 mb-0.5">DAYS</div>
                          <div className="text-sm font-bold text-brand-700">{totalDays}</div>
                        </div>
                      )}
                    </div>
                    <MiniCalendar startDate={startDate} endDate={endDate} onSelect={handleCalSelect} />
                    {startDate && (
                      <button
                        onClick={() => { setStartDate(null); setEndDate(null); setCalPhase('start'); }}
                        className="mt-2 text-xs text-brand-500 font-semibold press"
                      >
                        Reset dates
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* BUDGET */}
              {step === 'budget' && (
                <>
                  <StepTitle title="What's your daily budget?" subtitle="Per stop — we'll filter places accordingly" />
                  <div className="mt-6">
                    <div className="text-center mb-6">
                      <div className="text-4xl font-extrabold text-brand-600 font-display">{fmt(budget)}</div>
                      <div className="text-xs text-ink-500 mt-1">per stop</div>
                    </div>
                    <input
                      type="range" min={50_000} max={1_000_000} step={10_000}
                      value={budget}
                      onChange={(e) => setBudget(Number(e.target.value))}
                      className="vibe-slider w-full"
                      style={{ ['--val' as any]: `${sliderPct}%` }}
                    />
                    <div className="flex justify-between text-xs text-ink-500 mt-1">
                      <span>Rp 50K</span>
                      <span>Rp 1jt+</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-5">
                      {[150_000, 300_000, 600_000].map((v) => (
                        <button
                          key={v}
                          onClick={() => setBudget(v)}
                          className={`py-2 rounded-xl text-xs font-semibold press transition-colors border ${budget === v ? 'bg-brand-500 text-white border-brand-500' : 'bg-ink-50 text-ink-700 border-ink-100'}`}
                        >
                          {fmt(v)}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 flex items-start gap-2.5 bg-ink-50 rounded-2xl p-3">
                      <span className="text-lg shrink-0">💡</span>
                      <p className="text-xs text-ink-600 leading-relaxed">
                        Budget covers entry fees, food, and activities. Transport is extra. We'll always show you free alternatives.
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* INTERESTS */}
              {step === 'interests' && (
                <>
                  <StepTitle title="What do you love?" subtitle="Optional — helps us personalize your trip" />
                  <div className="mt-4 flex flex-wrap gap-2">
                    {INTEREST_OPTIONS.map((item) => {
                      const active = interests.includes(item.label);
                      return (
                        <motion.button
                          key={item.label}
                          whileTap={{ scale: 0.93 }}
                          onClick={() => setInterests((prev) => active ? prev.filter((x) => x !== item.label) : [...prev, item.label])}
                          className={`px-3 py-2 rounded-full text-sm font-semibold press border-2 transition-colors flex items-center gap-1.5 ${active ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-ink-700 border-ink-100'}`}
                        >
                          {item.emoji} {item.label}
                          {active && <Check className="w-3.5 h-3.5 ml-0.5" />}
                        </motion.button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* LOCATION */}
              {step === 'location' && (
                <>
                  <StepTitle title="Enable location?" subtitle="We'll use it to find nearby places and navigate" />
                  <div className="mt-6 space-y-4">
                    <div className="bg-brand-50 rounded-2xl p-4 border border-brand-100 space-y-3">
                      {[
                        { icon: '📍', title: 'Nearby discovery', desc: 'Find hidden gems within walking distance' },
                        { icon: '🧭', title: 'Turn-by-turn navigation', desc: 'Live directions between stops' },
                        { icon: '🔔', title: 'Smart alerts', desc: "Know when you're close to your next stop" },
                      ].map((item) => (
                        <div key={item.title} className="flex items-start gap-3">
                          <span className="text-xl shrink-0">{item.icon}</span>
                          <div>
                            <div className="font-semibold text-ink-900 text-sm">{item.title}</div>
                            <div className="text-xs text-ink-500">{item.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <AnimatePresence>
                      {locationDenied && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          className="flex items-start gap-2.5 bg-amber-50 rounded-xl p-3 border border-amber-200"
                        >
                          <span className="text-lg shrink-0">⚠️</span>
                          <div>
                            <div className="font-semibold text-amber-800 text-sm">Location access denied</div>
                            <div className="text-xs text-amber-700 mt-0.5">You can enable it later in Settings → Location</div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {!locationGranted ? (
                      <button
                        onClick={() => {
                          setTimeout(() => { setLocationGranted(true); setLocationDenied(false); }, 800);
                          setLocationDenied(false);
                        }}
                        className="w-full h-13 rounded-2xl bg-brand-500 text-white font-bold press shadow-glow flex items-center justify-center gap-2 py-3.5"
                      >
                        <MapPin className="w-5 h-5" /> Allow Location Access
                      </button>
                    ) : (
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        className="flex items-center gap-3 bg-emerald-50 rounded-2xl p-3 border border-emerald-200"
                      >
                        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                          <Check className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="font-bold text-emerald-800">Location enabled</div>
                          <div className="text-xs text-emerald-700">Full navigation features unlocked</div>
                        </div>
                      </motion.div>
                    )}
                    {!locationGranted && (
                      <button
                        onClick={() => setLocationDenied(true)}
                        className="w-full text-center text-sm text-ink-400 press py-1"
                      >
                        Skip for now
                      </button>
                    )}
                  </div>
                </>
              )}

            </div>

            {/* CTA — always at bottom, outside scroll, never clipped */}
            {cta && (
              <div className="px-5 pt-3 pb-8 bg-white shrink-0 border-t border-ink-50 space-y-2">
                <button
                  onClick={cta.onClick}
                  disabled={cta.disabled}
                  className={`w-full h-14 rounded-2xl font-bold text-base press shadow-glow flex items-center justify-center gap-2 disabled:bg-ink-200 disabled:text-ink-400 disabled:shadow-none ${cta.className ?? 'bg-brand-500 text-white'}`}
                >
                  {cta.label} {!cta.className && <ArrowRight className="w-4 h-4" />}
                </button>
                {cta.skipLabel && cta.onSkip && (
                  <button onClick={cta.onSkip} className="w-full text-center text-sm text-ink-400 press py-1">
                    {cta.skipLabel}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function StepTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="pt-1 pb-2">
      <h2 className="text-2xl font-extrabold text-ink-900 font-display leading-snug">{title}</h2>
      <p className="text-sm text-ink-500 mt-1">{subtitle}</p>
    </div>
  );
}

function FormField({
  label, icon, value, onChange, placeholder, type = 'text', error,
}: {
  label: string; icon: React.ReactNode; value: string;
  onChange: (v: string) => void; placeholder: string;
  type?: string; error?: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-bold tracking-widest text-ink-500 mb-1.5 flex items-center gap-1.5">
        {icon} {label.toUpperCase()}
      </div>
      <input
        type={type} value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-ink-50 rounded-xl px-3 py-3 text-sm text-ink-900 placeholder:text-ink-400 outline-none border-2 transition-colors ${error ? 'border-red-400' : 'border-transparent focus:border-brand-400'}`}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function MiniCalendar({
  startDate, endDate, onSelect,
}: {
  startDate: Date | null; endDate: Date | null; onSelect: (d: Date) => void;
}) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [viewYear, setViewYear] = useState(() => today.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => today.getMonth());

  const firstDow = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewYear, viewMonth, d));

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  return (
    <div className="bg-ink-50 rounded-2xl p-3">
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="w-8 h-8 rounded-full bg-white flex items-center justify-center press shadow-soft">
          <ArrowLeft className="w-4 h-4 text-ink-700" />
        </button>
        <span className="text-sm font-bold text-ink-900">{monthLabel}</span>
        <button onClick={nextMonth} className="w-8 h-8 rounded-full bg-white flex items-center justify-center press shadow-soft">
          <ArrowRight className="w-4 h-4 text-ink-700" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-bold text-ink-400 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const isStart = startDate ? isSameDay(d, startDate) : false;
          const isEnd = endDate ? isSameDay(d, endDate) : false;
          const inRange = startDate && endDate ? d > startDate && d < endDate : false;
          const isPast = d < today;
          const isToday = isSameDay(d, today);
          return (
            <button
              key={i}
              onClick={() => !isPast && onSelect(d)}
              disabled={isPast}
              className={[
                'relative aspect-square flex items-center justify-center text-[11px] font-semibold transition-colors',
                isStart || isEnd ? 'bg-brand-500 text-white rounded-full z-10' : '',
                inRange ? 'bg-brand-100 text-brand-700 rounded-none' : '',
                !isStart && !isEnd && !inRange && !isPast ? `rounded-full hover:bg-ink-200 ${isToday ? 'ring-1 ring-brand-400' : ''}` : '',
                isPast ? 'text-ink-300 cursor-default' : 'text-ink-800',
              ].filter(Boolean).join(' ')}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
